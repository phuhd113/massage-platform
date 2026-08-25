export default () => ({
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5433),
    user: process.env.DB_USER ?? 'massage',
    password: process.env.DB_PASSWORD ?? 'massage_dev_pw',
    name: process.env.DB_NAME ?? 'massage_platform',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6380),
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  otp: {
    stubEnabled: process.env.OTP_STUB_ENABLED !== 'false',
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  },
  upload: {
    dir: process.env.UPLOAD_DIR ?? './uploads',
    maxSizeMb: Number(process.env.UPLOAD_MAX_SIZE_MB ?? 5),
  },
});
