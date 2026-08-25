import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './common/config/configuration';
import { HealthController } from './common/health.controller';
import { dataSourceOptions } from './database/data-source';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { KtvProfileModule } from './modules/ktv-profile/ktv-profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true }),
    AuthModule,
    KtvProfileModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
