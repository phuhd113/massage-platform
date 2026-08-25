import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { OtpPurpose } from './entities/otp-code.entity';
import { OtpService } from './otp.service';

export type AuthTokens = {
  accessToken: string;
  user: { id: string; phone: string; role: UserRole };
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
  ) {}

  /** Đưa mọi biến thể số VN về dạng 0xxxxxxxxx để một người chỉ có một tài khoản. */
  normalizePhone(raw: string): string {
    return raw.startsWith('+84') ? `0${raw.slice(3)}` : raw;
  }

  async requestOtp(rawPhone: string, purpose: OtpPurpose = 'REGISTER') {
    const phone = this.normalizePhone(rawPhone);
    const result = await this.otpService.issue(phone, purpose);
    return { phone, expiresAt: result.expiresAt, debugCode: result.debugCode };
  }

  async verifyOtpAndIssueToken(
    rawPhone: string,
    code: string,
    purpose: OtpPurpose = 'REGISTER',
    role: UserRole = 'CUSTOMER',
  ): Promise<AuthTokens> {
    const phone = this.normalizePhone(rawPhone);
    const verification = await this.otpService.verify(phone, purpose, code);

    if (!verification.ok) {
      // Không tiết lộ chi tiết vì sao sai (không tồn tại / sai mã) để tránh
      // dò xem số nào đã đăng ký; chỉ tách riêng trường hợp bị khoá do thử quá nhiều.
      if (verification.reason === 'TOO_MANY_ATTEMPTS') {
        throw new BadRequestException('Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.');
      }
      throw new UnauthorizedException('Mã OTP không đúng hoặc đã hết hạn');
    }

    let user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      user = await this.userRepo.save(
        this.userRepo.create({ phone, role, phoneVerifiedAt: new Date() }),
      );
    } else if (!user.phoneVerifiedAt) {
      user.phoneVerifiedAt = new Date();
      await this.userRepo.save(user);
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });

    return {
      accessToken,
      user: { id: user.id, phone: user.phone, role: user.role },
    };
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }
}
