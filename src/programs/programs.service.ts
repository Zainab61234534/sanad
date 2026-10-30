import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { CreateProgramDto } from './dto/create-program.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { ListProgramsDto } from './dto/ListProgramsDto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { paged, PaginationDto} from '../common/dto/pagination.dto.js';
import { AuthUser } from '../common/decorators/index.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { AppCache } from '../common/cache/app-cache.service.js';
import { removeUpload } from '../common/uploads/upload.util.js';

// programs/programs.service.ts
const PUBLIC_SELECT = {
  id: true, title: true, description: true, imageUrl: true, capacity: true, reservedSeats: true, createdAt: true,
  supervisor: { select: { id: true, fullName: true } },      // اسم المشرف فقط، بدون بريد
} satisfies Prisma.ProgramSelect;

const withRemaining = <T extends { capacity: number; reservedSeats: number }>(p: T) => {
  const { reservedSeats, ...rest } = p;
  return { ...rest, remainingSeats: p.capacity - reservedSeats };
};

const skipTake = (q: PaginationDto) => ({
  skip: (q.page - 1) * q.limit,
  take: q.limit,
});

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService,
    private readonly cache: AppCache 
    
  ) {}

  async createProgram(user: AuthUser, dto: CreateProgramDto) {
    const program = await this.prisma.program.create({
      data: { ...dto, supervisorId: user.id },
    });
    await this.cache.bump(`program:${program.id}`);
    return withRemaining(program);
  }

  async list(q: ListProgramsDto) {
    const where: Prisma.ProgramWhereInput = {
      isPublished: true,
      ...(q.search && { OR: [
        { title: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ] }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.program.findMany({ where, select: PUBLIC_SELECT, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.program.count({ where }),
    ]);
    return paged(items.map(withRemaining), total, q);
  }
async detail(id: string) {
  // الجزء الثابت من الكاش
  const base = await this.cache.wrap(`program:${id}`, 'detail', 5 * 60_000, async () => {
    const p = await this.prisma.program.findFirst({
      where: { id, isPublished: true },
      select: {
        id: true, title: true, description: true, imageUrl: true, capacity: true, createdAt: true,
        supervisor: { select: { id: true, fullName: true } },
        sessions: { orderBy: { startsAt: 'asc' }, select: { id: true, startsAt: true, endsAt: true, location: true, onlineUrl: true } },
      },
    });
    if (!p) throw new NotFoundException('البرنامج غير موجود');
    return p;
  });
  // المقاعد: استعلام خفيف بالمفتاح الأساسي، حيّ دائمًا
  const seats = await this.prisma.program.findUnique({ where: { id }, select: { reservedSeats: true } });
  return withRemaining({ ...base, reservedSeats: seats?.reservedSeats ?? 0 });
}

  async listMine(user: AuthUser, q: PaginationDto) {
    const where = { supervisorId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.program.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.program.count({ where }),
    ]);
    return paged(items.map(withRemaining), total, q);
  }

  async update(user: AuthUser, id: string, dto: UpdateProgramDto) {
    // تعديل ذري: الملكية + عدم تقليل السعة تحت المحجوز في نفس الاستعلام
    const { count } = await this.prisma.program.updateMany({
      where: { id, supervisorId: user.id,
               ...(dto.capacity !== undefined && { reservedSeats: { lte: dto.capacity } }) },
      data: dto,
    });
    if (count === 0) {
      const owned = await this.prisma.program.findFirst({ where: { id, supervisorId: user.id }, select: { id: true } });
      throw owned
        ? new ConflictException('لا يمكن تقليل السعة إلى أقل من عدد المقاعد المحجوزة')
        : new NotFoundException('البرنامج غير موجود'); // 404 وليس 403 حتى لا يُكشف وجود برنامج مشرف آخر
    }
    const updated = await this.prisma.program.findUniqueOrThrow({ where: { id } });
    await this.cache.bump(`program:${id}`);
    return withRemaining(updated);
  }

  async setImage(user: AuthUser, id: string, imagePath: string) {
    const { program, previousImage } = await this.prisma.$transaction(async (tx) => {
      const current = await tx.program.findFirst({
        where: { id, supervisorId: user.id },
        select: { imageUrl: true },
      });
      if (!current) throw new NotFoundException('البرنامج غير موجود');

      await this.cache.bump(`program:${id}`);
      const { count } = await tx.program.updateMany({
        where: { id, supervisorId: user.id },
        data: { imageUrl: imagePath },
      });
      if (!count) throw new NotFoundException('البرنامج غير موجود');

      return {
        program: await tx.program.findUniqueOrThrow({ where: { id } }),
        previousImage: current.imageUrl,
      };
    });

    if (previousImage && /^images\/[0-9a-f-]+\.(jpg|jpeg|png|webp)$/i.test(previousImage)) {
      await removeUpload(previousImage);
    }

    return withRemaining(program);
  }
}