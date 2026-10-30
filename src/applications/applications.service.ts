import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ListApplicationsDto } from './dto/create-application.dto.js';
import { ApplicationStatus, Prisma } from '../generated/prisma/browser.js';
import { paged, skipTake } from '../common/dto/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/decorators/index.js';
import { streamUpload } from '../common/uploads/upload.util.js';
import { extname } from 'node:path';


// applications/applications.service.ts
const APP_SELECT = {
  id: true, status: true, cvUrl: true, reviewNote: true, createdAt: true, updatedAt: true,
  program: { select: { id: true, title: true } },
} satisfies Prisma.ApplicationSelect;

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────── 1) التقديم: حجز مقعد ─────────
  async apply(userId: string, programId: string, cvUrl?: string) {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // أ) الإنشاء أولًا: التكرار يفشل فورًا بـ P2002 عبر @@unique([userId, programId])
        const app = await tx.application.create({ data: { userId, programId, cvUrl }, select: APP_SELECT });

        // ب) حجز المقعد بشكل ذري ومشروط
        const reserved = await tx.$executeRaw`
          UPDATE "programs" SET "reservedSeats" = "reservedSeats" + 1
          WHERE "id" = ${programId} AND "isPublished" = true AND "reservedSeats" < "capacity"`;

        if (reserved === 0) {
          const exists = await tx.program.findFirst({ where: { id: programId, isPublished: true }, select: { id: true } });
          throw exists ? new ConflictException('اكتمل عدد المقاعد في هذا البرنامج')
                       : new NotFoundException('البرنامج غير موجود');
        } // رمي الاستثناء يُلغي إنشاء الطلب (rollback)
        return app;
      });
    } catch (e: unknown) {
      const prismaError = e as { code?: string } | undefined;
      if (prismaError && typeof prismaError === 'object' && 'code' in prismaError) {
        if (prismaError.code === 'P2002') throw new ConflictException('لقد قدّمت على هذا البرنامج مسبقًا');
        if (prismaError.code === 'P2003') throw new NotFoundException('البرنامج غير موجود');
      }
      throw e;
    }
  }

  async cvFile(user: AuthUser, id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      select: { userId: true, cvUrl: true },
    });

    if (!application?.cvUrl || (user.role !== 'ADMIN' && application.userId !== user.id)) {
      throw new NotFoundException('السيرة الذاتية غير موجودة');
    }

    const cvPath = application.cvUrl.startsWith('uploads/cv/')
      ? application.cvUrl.slice('uploads/'.length)
      : application.cvUrl;
    const extension = extname(cvPath).toLowerCase();
    const mimeTypeByExtension: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const mimeType = mimeTypeByExtension[extension];
    if (!mimeType) throw new NotFoundException('السيرة الذاتية غير موجودة');

    return streamUpload(cvPath, `cv${extension}`, mimeType);
  }

  // ───────── 2) الانتقال بين الحالات + إرجاع المقعد ─────────
  private async transition(
    tx: Prisma.TransactionClient,
    where: { id: string; userId?: string },
    from: ApplicationStatus[],
    to: ApplicationStatus,
    extra: Prisma.ApplicationUncheckedUpdateManyInput = {},
  ) {
    const app = await tx.application.findFirst({ where, select: { programId: true } });
    if (!app) throw new NotFoundException('الطلب غير موجود');

    // تحديث شرطي بالحالة الحالية: إن تزامن إلغاء مع رفض ينجح واحد فقط ويأخذ الآخر 409،
    // وبذلك لا يحدث إرجاع مقعد مرتين
    const { count } = await tx.application.updateMany({
      where: { ...where, status: { in: from } },
      data: { status: to, ...extra },
    });
    if (count === 0) throw new ConflictException('لا يمكن تنفيذ هذا الإجراء على الحالة الحالية للطلب');

    if (to === ApplicationStatus.REJECTED || to === ApplicationStatus.CANCELED) {
      await tx.$executeRaw`
        UPDATE "programs" SET "reservedSeats" = "reservedSeats" - 1
        WHERE "id" = ${app.programId} AND "reservedSeats" > 0`;
    }
    return tx.application.findUniqueOrThrow({ where: { id: where.id }, select: APP_SELECT });
  }

  // الشاب يلغي طلبه هو فقط (userId في الشرط)، من قيد المراجعة أو مقبول
  cancel(userId: string, id: string) {
    return this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      this.transition(tx, { id, userId }, [ApplicationStatus.PENDING, ApplicationStatus.ACCEPTED], ApplicationStatus.CANCELED));
  }

  // الأدمن: قبول (لا يغيّر العداد لأن المقعد محجوز أصلًا) أو رفض (يرجع المقعد)
  accept(adminId: string, id: string, note?: string) {
    return this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      this.transition(tx, { id }, [ApplicationStatus.PENDING], ApplicationStatus.ACCEPTED,
        { reviewedById: adminId, reviewedAt: new Date(), reviewNote: note }));
  }
  reject(adminId: string, id: string, note?: string) {
    return this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      this.transition(tx, { id }, [ApplicationStatus.PENDING], ApplicationStatus.REJECTED,
        { reviewedById: adminId, reviewedAt: new Date(), reviewNote: note }));
  }

  // ───────── 3) القوائم ─────────
  async listMine(userId: string, q: ListApplicationsDto) {
    const where: Prisma.ApplicationWhereInput = { userId, ...(q.status && { status: q.status }) }; // طلباته فقط
    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({ where, select: APP_SELECT, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.application.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async listAll(q: ListApplicationsDto) {
    const where: Prisma.ApplicationWhereInput = {
      ...(q.status && { status: q.status }), ...(q.programId && { programId: q.programId }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where, orderBy: { createdAt: 'asc' }, ...skipTake(q),
        select: { ...APP_SELECT, user: { select: { id: true, fullName: true, email: true } } },
      }),
      this.prisma.application.count({ where }),
    ]);
    return paged(items, total, q);
  }
}
