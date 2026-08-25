import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Certification } from '../ktv-profile/entities/certification.entity';
import { KtvProfile } from '../ktv-profile/entities/ktv-profile.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([KtvProfile, Certification]), AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
