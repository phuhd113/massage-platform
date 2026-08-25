import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtpCode } from './entities/otp-code.entity';
import { OtpService } from './otp.service';

/**
 * Test này chạy trên repository giả lập trong bộ nhớ, không cần Postgres:
 * mục tiêu là khẳng định các quy tắc bảo vệ OTP (hết hạn, giới hạn số lần thử,
 * mã chỉ dùng được một lần), chứ không phải kiểm tra tầng lưu trữ.
 */
class FakeOtpRepo {
  rows: OtpCode[] = [];

  create(data: Partial<OtpCode>): OtpCode {
    return { id: `id-${this.rows.length + 1}`, attempts: 0, consumedAt: null, createdAt: new Date(), ...data } as OtpCode;
  }
  async save(row: OtpCode): Promise<OtpCode> {
    this.rows.push(row);
    return row;
  }
  async update(where: Partial<OtpCode>, patch: Partial<OtpCode>): Promise<void> {
    for (const row of this.rows) {
      if (where.id && row.id !== where.id) continue;
      if (where.phone && row.phone !== where.phone) continue;
      if (where.purpose && row.purpose !== where.purpose) continue;
      if ('consumedAt' in where && row.consumedAt !== null) continue;
      Object.assign(row, patch);
    }
  }
  async increment(where: Partial<OtpCode>, field: 'attempts', by: number): Promise<void> {
    const row = this.rows.find((r) => r.id === where.id);
    if (row) row[field] += by;
  }
  async findOne(opts: { where: Partial<OtpCode> }): Promise<OtpCode | null> {
    const matches = this.rows.filter(
      (r) =>
        r.phone === opts.where.phone &&
        r.purpose === opts.where.purpose &&
        r.consumedAt === null,
    );
    return matches.at(-1) ?? null;
  }
  async delete(): Promise<{ affected: number }> {
    return { affected: 0 };
  }
}

describe('OtpService', () => {
  let service: OtpService;
  let repo: FakeOtpRepo;

  beforeEach(async () => {
    repo = new FakeOtpRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: getRepositoryToken(OtpCode), useValue: repo as unknown as Repository<OtpCode> },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: unknown) =>
              ({ 'otp.stubEnabled': true, 'otp.ttlSeconds': 300, 'otp.maxAttempts': 3 })[key] ??
              fallback,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(OtpService);
  });

  it('mã đúng thì xác thực thành công', async () => {
    const issued = await service.issue('0901234567', 'REGISTER');
    await expect(
      service.verify('0901234567', 'REGISTER', issued.debugCode!),
    ).resolves.toEqual({ ok: true });
  });

  it('một mã chỉ dùng được đúng một lần', async () => {
    const issued = await service.issue('0901234567', 'REGISTER');
    await service.verify('0901234567', 'REGISTER', issued.debugCode!);

    const second = await service.verify('0901234567', 'REGISTER', issued.debugCode!);
    expect(second).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('yêu cầu mã mới sẽ vô hiệu hoá mã cũ', async () => {
    const first = await service.issue('0901234567', 'REGISTER');
    await service.issue('0901234567', 'REGISTER');

    const result = await service.verify('0901234567', 'REGISTER', first.debugCode!);
    expect(result).toEqual({ ok: false, reason: 'MISMATCH' });
  });

  it('khoá lại sau khi vượt số lần thử cho phép', async () => {
    await service.issue('0901234567', 'REGISTER');
    for (let i = 0; i < 3; i++) {
      await service.verify('0901234567', 'REGISTER', '000000');
    }
    const result = await service.verify('0901234567', 'REGISTER', '000000');
    expect(result).toEqual({ ok: false, reason: 'TOO_MANY_ATTEMPTS' });
  });

  it('mã hết hạn thì không dùng được', async () => {
    const issued = await service.issue('0901234567', 'REGISTER');
    repo.rows[repo.rows.length - 1].expiresAt = new Date(Date.now() - 1000);

    const result = await service.verify('0901234567', 'REGISTER', issued.debugCode!);
    expect(result).toEqual({ ok: false, reason: 'EXPIRED' });
  });
});
