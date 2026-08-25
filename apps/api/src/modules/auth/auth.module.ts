import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpCode } from './entities/otp-code.entity';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OtpService } from './otp.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, OtpCode]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn', '7d') as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
