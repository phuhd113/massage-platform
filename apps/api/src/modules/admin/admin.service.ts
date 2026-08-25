import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certification } from '../ktv-profile/entities/certification.entity';
import { KtvProfile, VerificationStatus } from '../ktv-profile/entities/ktv-profile.entity';
import { VerifyDecisionDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(KtvProfile)
    private readonly profileRepo: Repository<KtvProfile>,
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
  ) {}

  async listProfiles(
    status: VerificationStatus = 'PENDING',
    page = 1,
    limit = 20,
  ) {
    const [items, total] = await this.profileRepo.findAndCount({
      where: { verificationStatus: status },
      relations: { certifications: true },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async decideProfile(
    ktvId: string,
    adminId: string,
    dto: VerifyDecisionDto,
  ): Promise<KtvProfile> {
    const profile = await this.profileRepo.findOne({ where: { id: ktvId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ KTV');

    profile.verificationStatus = dto.decision;
    profile.rejectionReason = dto.decision === 'REJECTED' ? (dto.reason ?? null) : null;
    profile.verifiedBy = adminId;
    profile.verifiedAt = new Date();
    return this.profileRepo.save(profile);
  }

  async decideCertification(
    certId: string,
    adminId: string,
    dto: VerifyDecisionDto,
  ): Promise<Certification> {
    const cert = await this.certRepo.findOne({ where: { id: certId } });
    if (!cert) throw new NotFoundException('Không tìm thấy chứng chỉ');

    cert.verifyStatus = dto.decision;
    cert.rejectionReason = dto.decision === 'REJECTED' ? (dto.reason ?? null) : null;
    cert.verifiedBy = adminId;
    cert.verifiedAt = new Date();
    return this.certRepo.save(cert);
  }
}
