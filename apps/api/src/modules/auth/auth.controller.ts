import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { CurrentUser, JwtPayload } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone, dto.purpose ?? 'REGISTER');
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtpAndIssueToken(
      dto.phone,
      dto.code,
      dto.purpose ?? 'REGISTER',
      dto.role ?? 'CUSTOMER',
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    const found = await this.authService.findById(user.sub);
    return found
      ? { id: found.id, phone: found.phone, role: found.role, email: found.email }
      : null;
  }
}
