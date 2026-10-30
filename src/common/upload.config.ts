// common/upload.config.ts  (رفع السيرة الذاتية: أنواع مسموحة وحجم محدود، والتخزين على القرص ومسار الملف فقط في القاعدة)
import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { mkdirSync } from 'fs';

const CV_MIME = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const CV_EXT = ['.pdf', '.doc', '.docx'];

export const cvUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => { mkdirSync('uploads/cv', { recursive: true }); cb(null, 'uploads/cv'); },
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`), // اسم عشوائي
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = CV_MIME.includes(file.mimetype) && CV_EXT.includes(extname(file.originalname).toLowerCase());
    cb(ok ? null : new BadRequestException('الملف يجب أن يكون PDF أو DOC أو DOCX وبحجم أقل من 5MB'), ok);
  },
};