import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { KtvProfile, VerificationStatus } from './ktv-profile.entity';

@Entity('certifications')
export class Certification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ktv_id', type: 'uuid' })
  ktvId!: string;

  @ManyToOne(() => KtvProfile, (ktv) => ktv.certifications)
  @JoinColumn({ name: 'ktv_id' })
  ktv?: KtvProfile;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'issuing_org', type: 'varchar', length: 150, nullable: true })
  issuingOrg!: string | null;

  @Column({ name: 'issued_at', type: 'date', nullable: true })
  issuedAt!: string | null;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl!: string;

  @Column({ name: 'verify_status', type: 'varchar', length: 20, default: 'PENDING' })
  verifyStatus!: VerificationStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
