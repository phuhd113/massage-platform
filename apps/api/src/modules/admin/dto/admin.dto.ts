import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class VerifyDecisionDto {
  @IsEnum(['VERIFIED', 'REJECTED'], {
    message: 'Quyết định phải là VERIFIED hoặc REJECTED',
  })
  decision!: 'VERIFIED' | 'REJECTED';

  // Từ chối mà không nêu lý do thì KTV không biết phải sửa gì và sẽ nộp lại y hệt,
  // tạo vòng lặp tốn công cho cả hai phía.
  @ValidateIf((o: VerifyDecisionDto) => o.decision === 'REJECTED')
  @IsString()
  @MinLength(5, { message: 'Cần nêu lý do từ chối để KTV biết cách bổ sung' })
  @MaxLength(500)
  reason?: string;
}

export class ListPendingQueryDto {
  @IsOptional()
  @IsEnum(['PENDING', 'VERIFIED', 'REJECTED'])
  status?: 'PENDING' | 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
