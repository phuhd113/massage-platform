import { randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsNull, LessThan, Repository } from 'typeorm';
import { OtpCode, OtpPurpose } from './entities/otp-code.entity';

export type OtpIssueResult = {
  expiresAt: Date;
  /** Chỉ có giá trị khi chạy chế độ stub (dev). Ở production luôn là undefined. */
  debugCode?: string;
};

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'MISMATCH' };

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepo: Repository<OtpCode>,
    private readonly config: ConfigService,
  ) {}

  async issue(phone: string, purpose: OtpPurpose): Promise<OtpIssueResult> {
    // Vô hiệu hoá các mã cũ chưa dùng: mỗi số điện thoại chỉ có đúng một mã sống
    // tại một thời điểm, nếu không kẻ tấn công có nhiều mã hợp lệ để thử song song.
    await this.otpRepo.update(
      { phone, purpose, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const ttlSeconds = this.config.get<number>('otp.ttlSeconds', 300);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        phone,
        purpose,
        codeHash: await bcrypt.hash(code, 8),
        expiresAt,
      }),
    );

    const stub = this.config.get<boolean>('otp.stubEnabled', true);
    if (stub) {
      this.logger.warn(`[OTP STUB] ${phone} (${purpose}) -> ${code}`);
      return { expiresAt, debugCode: code };
    }

    // Khi cắm nhà cung cấp SMS thật, thay chỗ này bằng lời gọi adapter.
    // Giữ nguyên chữ ký hàm để phần còn lại của luồng đăng ký không phải sửa.
    throw new Error('SMS provider chưa được cấu hình. Đặt OTP_STUB_ENABLED=true cho môi trường dev.');
  }

  async verify(
    phone: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<OtpVerifyResult> {
    const record = await this.otpRepo.findOne({
      where: { phone, purpose, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!record) return { ok: false, reason: 'NOT_FOUND' };
    if (record.expiresAt.getTime() < Date.now()) {
      return { ok: false, reason: 'EXPIRED' };
    }

    const maxAttempts = this.config.get<number>('otp.maxAttempts', 5);
    if (record.attempts >= maxAttempts) {
      return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
    }

    const matched = await bcrypt.compare(code, record.codeHash);
    if (!matched) {
      await this.otpRepo.increment({ id: record.id }, 'attempts', 1);
      return { ok: false, reason: 'MISMATCH' };
    }

    // Đánh dấu đã dùng ngay khi khớp — một mã chỉ đổi được một lần thành phiên đăng nhập.
    await this.otpRepo.update({ id: record.id }, { consumedAt: new Date() });
    return { ok: true };
  }

  async purgeExpired(): Promise<number> {
    const result = await this.otpRepo.delete({ expiresAt: LessThan(new Date()) });
    return result.affected ?? 0;
  }
}
