import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { LoggerOptions } from 'typeorm/logger/LoggerOptions';

loadEnv();

export const dataSourceOptions = {
  type: 'postgres' as const,
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'massage',
  password: process.env.DB_PASSWORD ?? 'massage_dev_pw',
  database: process.env.DB_NAME ?? 'massage_platform',
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // Schema chỉ được thay đổi qua migration có review — synchronize sẽ âm thầm
  // drop cột khi entity đổi, thứ không bao giờ chấp nhận được với dữ liệu thật.
  synchronize: false,
  logging: (process.env.NODE_ENV === 'development'
    ? ['error', 'warn']
    : ['error']) as LoggerOptions,
};

export default new DataSource(dataSourceOptions);
