import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AdministrativeArea } from './entities/administrative-area.entity';
import { Certification } from './entities/certification.entity';
import { CoverageArea } from './entities/coverage-area.entity';
import { KtvProfile } from './entities/ktv-profile.entity';
import { KtvProfileController } from './ktv-profile.controller';
import { KtvProfileService } from './ktv-profile.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KtvProfile,
      Certification,
      CoverageArea,
      AdministrativeArea,
    ]),
    AuthModule,
  ],
  controllers: [KtvProfileController],
  providers: [KtvProfileService],
  exports: [KtvProfileService],
})
export class KtvProfileModule {}
