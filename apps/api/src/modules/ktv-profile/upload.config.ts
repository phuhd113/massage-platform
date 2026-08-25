import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/**
 * Phase 0 lưu file lên đĩa local để không phải chờ dựng S3/R2.
 * Khi chuyển sang object storage, chỉ cần đổi `storage` ở đây — phần còn lại
 * của luồng upload không phụ thuộc vào nơi file nằm.
 */
export const certificationMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: process.env.UPLOAD_DIR ?? './uploads',
    filename: (_req, file, callback) => {
      // Không bao giờ dùng tên file do client gửi lên làm tên lưu trữ:
      // nó có thể chứa ../ để ghi đè file ngoài thư mục uploads.
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_SIZE_MB ?? 5) * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
      callback(
        new BadRequestException('Chỉ chấp nhận file JPG, PNG, WEBP hoặc PDF'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
