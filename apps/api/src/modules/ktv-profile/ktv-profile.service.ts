import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  CreateCertificationDto,
  CreateKtvProfileDto,
  UpdateKtvProfileDto,
} from './dto/ktv-profile.dto';
import { AdministrativeArea } from './entities/administrative-area.entity';
import { Certification } from './entities/certification.entity';
import { CoverageArea } from './entities/coverage-area.entity';
import { GeoPoint, KtvProfile } from './entities/ktv-profile.entity';
import { toSlug } from './slug.util';

function toGeoPoint(lon: number, lat: number): GeoPoint {
  return { type: 'Point', coordinates: [lon, lat] };
}

@Injectable()
export class KtvProfileService {
  constructor(
    @InjectRepository(KtvProfile)
    private readonly profileRepo: Repository<KtvProfile>,
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
    @InjectRepository(AdministrativeArea)
    private readonly areaRepo: Repository<AdministrativeArea>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateKtvProfileDto): Promise<KtvProfile> {
    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Tài khoản này đã có hồ sơ KTV');
    }

    await this.assertAreasExist(dto.coverageAreaIds);

    const profile = this.profileRepo.create({
      userId,
      fullName: dto.fullName,
      slug: await this.generateUniqueSlug(dto.fullName),
      bio: dto.bio ?? null,
      yearsExperience: dto.yearsExperience ?? 0,
      basePoint: toGeoPoint(dto.lon, dto.lat),
      baseAddress: dto.baseAddress ?? null,
      serviceRadiusKm: dto.serviceRadiusKm,
      verificationStatus: 'PENDING',
    });

    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(profile);
      await this.replaceCoverageAreas(manager, saved.id, dto.coverageAreaIds);
      return saved;
    });
  }

  async update(userId: string, dto: UpdateKtvProfileDto): Promise<KtvProfile> {
    const profile = await this.getByUserId(userId);
    await this.assertAreasExist(dto.coverageAreaIds);

    if (dto.fullName !== undefined) profile.fullName = dto.fullName;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.yearsExperience !== undefined) profile.yearsExperience = dto.yearsExperience;
    if (dto.baseAddress !== undefined) profile.baseAddress = dto.baseAddress;
    if (dto.serviceRadiusKm !== undefined) profile.serviceRadiusKm = dto.serviceRadiusKm;

    if (dto.lat !== undefined || dto.lon !== undefined) {
      if (dto.lat === undefined || dto.lon === undefined) {
        throw new BadRequestException('Phải gửi đồng thời cả lat và lon khi đổi vị trí');
      }
      profile.basePoint = toGeoPoint(dto.lon, dto.lat);
    }

    // Hồ sơ đã duyệt mà sửa thông tin thì phải duyệt lại: nếu không, KTV có thể
    // được duyệt bằng hồ sơ sạch rồi đổi sang nội dung khác sau lưng admin.
    if (profile.verificationStatus === 'VERIFIED') {
      profile.verificationStatus = 'PENDING';
      profile.rejectionReason = null;
    }

    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(profile);
      if (dto.coverageAreaIds) {
        await this.replaceCoverageAreas(manager, saved.id, dto.coverageAreaIds);
      }
      return saved;
    });
  }

  async getByUserId(userId: string): Promise<KtvProfile> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: { certifications: true },
    });
    if (!profile) throw new NotFoundException('Chưa có hồ sơ KTV cho tài khoản này');
    return profile;
  }

  async getById(id: string): Promise<KtvProfile> {
    const profile = await this.profileRepo.findOne({
      where: { id },
      relations: { certifications: true },
    });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ KTV');
    return profile;
  }

  async addCertification(
    userId: string,
    dto: CreateCertificationDto,
    fileUrl: string,
  ): Promise<Certification> {
    const profile = await this.getByUserId(userId);
    return this.certRepo.save(
      this.certRepo.create({
        ktvId: profile.id,
        name: dto.name,
        issuingOrg: dto.issuingOrg ?? null,
        issuedAt: dto.issuedAt ?? null,
        fileUrl,
        verifyStatus: 'PENDING',
      }),
    );
  }

  async listCoverageAreaIds(ktvId: string): Promise<string[]> {
    const rows = await this.dataSource
      .getRepository(CoverageArea)
      .find({ where: { ktvId } });
    return rows.map((r) => r.areaId);
  }

  private async assertAreasExist(areaIds?: string[]): Promise<void> {
    if (!areaIds?.length) return;
    const found = await this.areaRepo.count({ where: { id: In(areaIds) } });
    if (found !== new Set(areaIds).size) {
      throw new BadRequestException('Có khu vực hoạt động không tồn tại');
    }
  }

  private async replaceCoverageAreas(
    manager: DataSource['manager'],
    ktvId: string,
    areaIds?: string[],
  ): Promise<void> {
    await manager.delete(CoverageArea, { ktvId });
    if (!areaIds?.length) return;
    const unique = [...new Set(areaIds)];
    await manager.insert(
      CoverageArea,
      unique.map((areaId) => ({ ktvId, areaId })),
    );
  }

  private async generateUniqueSlug(fullName: string): Promise<string> {
    const base = toSlug(fullName) || 'ktv';
    let candidate = base;
    let suffix = 1;
    while (await this.profileRepo.exists({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}
