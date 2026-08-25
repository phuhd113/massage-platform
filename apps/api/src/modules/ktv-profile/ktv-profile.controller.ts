import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import {
  CreateCertificationDto,
  CreateKtvProfileDto,
  UpdateKtvProfileDto,
} from './dto/ktv-profile.dto';
import { KtvProfileService } from './ktv-profile.service';
import { certificationMulterOptions } from './upload.config';

@Controller('ktv')
export class KtvProfileController {
  constructor(private readonly service: KtvProfileService) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('KTV')
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateKtvProfileDto) {
    return this.service.create(user.sub, dto);
  }

  @Get('profile/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('KTV')
  async myProfile(@CurrentUser() user: JwtPayload) {
    return this.service.getByUserId(user.sub);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('KTV')
  async update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateKtvProfileDto) {
    return this.service.update(user.sub, dto);
  }

  @Post('certifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('KTV')
  @UseInterceptors(FileInterceptor('file', certificationMulterOptions))
  async addCertification(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCertificationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Cần đính kèm ảnh/PDF chứng chỉ ở trường "file"');
    }
    return this.service.addCertification(user.sub, dto, `/uploads/${file.filename}`);
  }

  @Get(':id')
  async getPublicProfile(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getById(id);
  }
}
