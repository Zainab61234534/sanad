import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus } from '../generated/prisma/browser.js';
import type { AuthUser } from '../common/decorators/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { removeUpload, streamUpload } from '../common/uploads/upload.util.js';

type MaterialFile = {
  path: string;
  mimeType: string;
  size: number;
  originalName: string;
};

const MATERIAL_SELECT = {
  id: true,
  title: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAccess(user: AuthUser, programId: string) {
    if (user.role === 'ADMIN') return;

    if (user.role === 'SUPERVISOR') {
      const own = await this.prisma.program.findFirst({
        where: { id: programId, supervisorId: user.id },
        select: { id: true },
      });
      if (!own) throw new NotFoundException('البرنامج غير موجود');
      return;
    }

    const acceptedApplication = await this.prisma.application.findFirst({
      where: {
        programId,
        userId: user.id,
        status: ApplicationStatus.ACCEPTED,
      },
      select: { id: true },
    });
    if (!acceptedApplication) {
      throw new ForbiddenException('المواد متاحة فقط للمقبولين في البرنامج');
    }
  }

  async create(user: AuthUser, programId: string, title: string, file: MaterialFile) {
    const own = await this.prisma.program.findFirst({
      where: { id: programId, supervisorId: user.id },
      select: { id: true },
    });
    if (!own) throw new NotFoundException('البرنامج غير موجود');

    return this.prisma.programMaterial.create({
      data: {
        programId,
        title,
        fileUrl: file.path,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        uploadedById: user.id,
      },
      select: MATERIAL_SELECT,
    });
  }

  async list(user: AuthUser, programId: string) {
    await this.assertAccess(user, programId);
    return this.prisma.programMaterial.findMany({
      where: { programId },
      orderBy: { createdAt: 'desc' },
      select: MATERIAL_SELECT,
    });
  }

  async download(user: AuthUser, id: string) {
    const material = await this.prisma.programMaterial.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('المادة غير موجودة');

    await this.assertAccess(user, material.programId);
    return streamUpload(material.fileUrl, material.originalName, material.mimeType);
  }

  async remove(user: AuthUser, id: string) {
    const material = await this.prisma.programMaterial.findFirst({
      where: { id, program: { supervisorId: user.id } },
    });
    if (!material) throw new NotFoundException('المادة غير موجودة');

    await this.prisma.programMaterial.delete({ where: { id } });
    await removeUpload(material.fileUrl);
    return { success: true };
  }
}
