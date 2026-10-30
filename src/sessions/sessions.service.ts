import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/index.js';
import { AppCache } from '../common/cache/app-cache.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';

type SessionFields = {
  startsAt: string | Date;
  endsAt?: string | Date | null;
  location?: string | null;
  onlineUrl?: string | null;
};

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCache,
  ) {}

  private validate(session: SessionFields) {
    if (!session.location && !session.onlineUrl) {
      throw new BadRequestException('حدّد مكان الجلسة أو رابطها');
    }

    if (session.endsAt && new Date(session.endsAt) <= new Date(session.startsAt)) {
      throw new BadRequestException('وقت النهاية يجب أن يكون بعد البداية');
    }
  }

  async create(user: AuthUser, programId: string, dto: CreateSessionDto) {
    this.validate(dto);
    const own = await this.prisma.program.findFirst({
      where: { id: programId, supervisorId: user.id },
      select: { id: true },
    });
    if (!own) throw new NotFoundException('البرنامج غير موجود');

    const session = await this.prisma.session.create({
      data: {
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        location: dto.location,
        onlineUrl: dto.onlineUrl,
        programId,
      },
    });
    await this.cache.bump(`program:${programId}`);
    return session;
  }

  async update(user: AuthUser, id: string, dto: UpdateSessionDto) {
    const current = await this.prisma.session.findFirst({
      where: { id, program: { supervisorId: user.id } },
    });
    if (!current) throw new NotFoundException('الجلسة غير موجودة');

    this.validate({
      startsAt: dto.startsAt ?? current.startsAt,
      endsAt: dto.endsAt !== undefined ? dto.endsAt : current.endsAt,
      location: dto.location !== undefined ? dto.location : current.location,
      onlineUrl: dto.onlineUrl !== undefined ? dto.onlineUrl : current.onlineUrl,
    });
    const session = await this.prisma.session.update({
      where: { id },
      data: {
        ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt !== undefined && {
          endsAt: dto.endsAt === null ? null : new Date(dto.endsAt),
        }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.onlineUrl !== undefined && { onlineUrl: dto.onlineUrl }),
      },
    });
    await this.cache.bump(`program:${current.programId}`);
    return session;
  }

  async remove(user: AuthUser, id: string) {
    const current = await this.prisma.session.findFirst({
      where: { id, program: { supervisorId: user.id } },
      select: { programId: true },
    });
    if (!current) throw new NotFoundException('الجلسة غير موجودة');

    await this.prisma.session.delete({ where: { id } });
    await this.cache.bump(`program:${current.programId}`);
    return { success: true };
  }
}
