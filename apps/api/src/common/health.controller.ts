import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    // Kiểm tra cả PostGIS, không chỉ kết nối: thiếu extension thì mọi truy vấn
    // geo sẽ fail lúc chạy chứ không phải lúc khởi động.
    const [{ postgis_version }] = await this.dataSource.query<
      { postgis_version: string }[]
    >('SELECT postgis_version() AS postgis_version');

    return { status: 'ok', database: 'up', postgis: postgis_version };
  }
}
