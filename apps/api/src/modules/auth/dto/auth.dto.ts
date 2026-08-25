import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

// Chấp nhận cả dạng 0xxxxxxxxx và +84xxxxxxxxx; chuẩn hoá về một dạng duy nhất
// ở service để không tạo hai tài khoản cho cùng một số.
const VN_PHONE = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

export class RequestOtpDto {
  @Matches(VN_PHONE, { message: 'Số điện thoại không hợp lệ' })
  phone!: string;

  @IsOptional()
  @IsEnum(['REGISTER', 'LOGIN'])
  purpose?: 'REGISTER' | 'LOGIN';
}

export class VerifyOtpDto {
  @Matches(VN_PHONE, { message: 'Số điện thoại không hợp lệ' })
  phone!: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số' })
  code!: string;

  @IsOptional()
  @IsEnum(['REGISTER', 'LOGIN'])
  purpose?: 'REGISTER' | 'LOGIN';

  @IsOptional()
  @IsEnum(['CUSTOMER', 'KTV'])
  role?: 'CUSTOMER' | 'KTV';
}
