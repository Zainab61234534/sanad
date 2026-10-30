// common/uploads/upload.util.ts
import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor, NotFoundException, StreamableFile } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { open, unlink } from 'fs/promises';
import { extname, join, resolve, sep } from 'path';
import { catchError, throwError } from 'rxjs';

export const UPLOAD_ROOT = resolve(process.cwd(), 'uploads');

export const FILE_KINDS = {
  cv:       { dir: 'cv',        exts: ['.pdf'], maxMb: 5 },
  image:    { dir: 'images',    exts: ['.jpg', '.jpeg', '.png', '.webp'], maxMb: 2 },
  material: { dir: 'materials', exts: ['.pdf', '.docx', '.pptx', '.xlsx', '.jpg', '.jpeg', '.png'], maxMb: 20 },
} as const;
export type UploadKind = keyof typeof FILE_KINDS;

const SIG_BY_EXT: Record<string, (b: Buffer) => boolean> = {
  '.pdf':  (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  '.png':  (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.jpg':  (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  '.jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  '.webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  '.docx': (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04, // ZIP
  '.pptx': (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  '.xlsx': (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
};
const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function uploadOptions(kind: UploadKind): MulterOptions {
  const k = FILE_KINDS[kind];
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => { const d = join(UPLOAD_ROOT, k.dir); mkdirSync(d, { recursive: true }); cb(null, d); },
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: k.maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ok = (k.exts as readonly string[]).includes(extname(file.originalname).toLowerCase());
      cb(ok ? null : new BadRequestException(`الأنواع المسموحة: ${k.exts.join(' , ')} (الحد الأقصى ${k.maxMb}MB)`), ok);
    },
  };
}

/** يتحقق من محتوى الملف الفعلي ويعيد البيانات التي تُخزَّن في القاعدة */
export async function finalizeUpload(kind: UploadKind, file: Express.Multer.File) {
  const ext = extname(file.filename).toLowerCase();
  const fh = await open(file.path, 'r');
  let ok = false;
  try { const buf = Buffer.alloc(12); await fh.read(buf, 0, 12, 0); ok = !!SIG_BY_EXT[ext]?.(buf); }
  finally { await fh.close(); }
  if (!ok) throw new BadRequestException('محتوى الملف لا يطابق نوعه'); // يُحذف بواسطة UploadCleanupInterceptor
  return {
    path: `${FILE_KINDS[kind].dir}/${file.filename}`,                 // مسار نسبي فقط
    mimeType: MIME_BY_EXT[ext],                                       // من الامتداد المتحقق منه، لا من العميل
    size: file.size,
    originalName: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255), // إصلاح ترميز الأسماء العربية في Multer
  };
}

/** أي خطأ بعد وصول الملف (تحقق DTO أو منطق أو قاعدة بيانات) يحذف الملف فلا تبقى ملفات يتيمة */
@Injectable()
export class UploadCleanupInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(catchError((err) => {
      if (req.file?.path) unlink(req.file.path).catch(() => undefined);
      return throwError(() => err);
    }));
  }
}

export function resolveUpload(rel: string) {
  const abs = resolve(UPLOAD_ROOT, rel);
  if (!abs.startsWith(UPLOAD_ROOT + sep)) throw new NotFoundException(); // حماية Path Traversal
  return abs;
}
export const removeUpload = (rel?: string | null) => (rel ? unlink(resolveUpload(rel)).catch(() => undefined) : Promise.resolve());

export function streamUpload(rel: string, downloadName: string, mime: string) {
  const abs = resolveUpload(rel);
  if (!existsSync(abs)) throw new NotFoundException('الملف غير موجود');
  return new StreamableFile(createReadStream(abs), {
    type: mime, disposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
  });
}