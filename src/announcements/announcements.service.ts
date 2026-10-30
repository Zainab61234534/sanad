import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { AnnouncementScope, ApplicationStatus, Prisma } from '../generated/prisma/browser.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthUser } from '../common/decorators/index.js';
import { paged, PaginationDto, skipTake } from '../common/dto/pagination.dto.js';
import { AppCache } from '../common/cache/app-cache.service.js';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto.js';

// announcements/announcements.service.ts
const ANN_SELECT = {
  id: true, title: true, content: true, scope: true, createdAt: true,
  program: { select: { id: true, title: true } },
  author: { select: { id: true, fullName: true } },
} satisfies Prisma.AnnouncementSelect;

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService , 
    private readonly cache: AppCache
  ) {}

  async listGeneral(q: PaginationDto) {
    const load = async () => {
      const where = { scope: AnnouncementScope.GENERAL };
      const [items, total] = await this.prisma.$transaction([
        this.prisma.announcement.findMany({
          where,
          select: ANN_SELECT,
          orderBy: { createdAt: 'desc' },
          ...skipTake(q),
        }),
        this.prisma.announcement.count({ where }),
      ]);
      return paged(items, total, q);
    };

    return q.page <= 10
      ? this.cache.wrap('announcements:general', `p${q.page}:l${q.limit}`, 60_000, load)
      : load();
  }

  // أدمن: إعلان عام
  async createGeneral(adminId: string, dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.announcement.create({
      data: { ...dto, scope: AnnouncementScope.GENERAL, authorId: adminId }, select: ANN_SELECT });
    await this.cache.bump('announcements:general');
    return announcement;
  }

  async updateGeneral(id: string, dto: UpdateAnnouncementDto) {
    const { count } = await this.prisma.announcement.updateMany({
      where: { id, scope: AnnouncementScope.GENERAL },
      data: dto,
    });
    if (!count) throw new NotFoundException('الإعلان غير موجود');
    await this.cache.bump('announcements:general');
    return this.prisma.announcement.findUniqueOrThrow({ where: { id }, select: ANN_SELECT });
  }

  async removeGeneral(id: string) {
    const { count } = await this.prisma.announcement.deleteMany({
      where: { id, scope: AnnouncementScope.GENERAL },
    });
    if (!count) throw new NotFoundException('الإعلان غير موجود');
    await this.cache.bump('announcements:general');
    return { success: true };
  }

  // مشرف: إعلان لبرنامجه هو فقط
  async createForProgram(user: AuthUser, programId: string, dto: CreateAnnouncementDto) {
    const owned = await this.prisma.program.findFirst({ where: { id: programId, supervisorId: user.id }, select: { id: true } });
    if (!owned) throw new NotFoundException('البرنامج غير موجود');
    return this.prisma.announcement.create({
      data: { ...dto, scope: AnnouncementScope.PROGRAM, programId, authorId: user.id }, select: ANN_SELECT });
  }

  // شاب: العامة + الخاصة بالبرامج التي هو مقبول فيها
  async listForYouth(userId: string, q: PaginationDto) {
    const where: Prisma.AnnouncementWhereInput = { OR: [
      { scope: AnnouncementScope.GENERAL },
      { scope: AnnouncementScope.PROGRAM,
        program: { applications: { some: { userId, status: ApplicationStatus.ACCEPTED } } } },
    ] };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({ where, select: ANN_SELECT, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      this.prisma.announcement.count({ where }),
    ]);
    return paged(items, total, q);
  }
}
