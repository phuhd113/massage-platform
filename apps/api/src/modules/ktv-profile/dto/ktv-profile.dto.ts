import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateKtvProfileDto {
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  yearsExperience?: number;

  @Type(() => Number)
  @IsLatitude({ message: 'Vĩ độ không hợp lệ' })
  lat!: number;

  @Type(() => Number)
  @IsLongitude({ message: 'Kinh độ không hợp lệ' })
  lon!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseAddress?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  serviceRadiusKm!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  coverageAreaIds?: string[];
}

export class UpdateKtvProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  yearsExperience?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lon?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  coverageAreaIds?: string[];
}

export class CreateCertificationDto {
  @IsString()
  @Length(2, 150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  issuingOrg?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày cấp phải theo định dạng YYYY-MM-DD' })
  issuedAt?: string;
}
