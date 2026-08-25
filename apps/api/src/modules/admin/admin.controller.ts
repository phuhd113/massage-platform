import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { ListPendingQueryDto, VerifyDecisionDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('ktv')
  async listProfiles(@Query() query: ListPendingQueryDto) {
    return this.service.listProfiles(
      query.status ?? 'PENDING',
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Patch('ktv/:id/verify')
  async verifyProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: VerifyDecisionDto,
  ) {
    return this.service.decideProfile(id, admin.sub, dto);
  }

  @Patch('certifications/:id/verify')
  async verifyCertification(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: VerifyDecisionDto,
  ) {
    return this.service.decideCertification(id, admin.sub, dto);
  }
}
