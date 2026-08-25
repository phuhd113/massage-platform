import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Certification } from './certification.entity';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

/** GeoJSON Point mà PostGIS trả về / nhận vào: [longitude, latitude]. */
export type GeoPoint = { type: 'Point'; coordinates: [number, number] };

@Entity('ktv_profiles')
export class KtvProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ name: 'years_experience', type: 'smallint', default: 0 })
  yearsExperience!: number;

  @Column({
    name: 'base_point',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  basePoint!: GeoPoint;

  @Column({ name: 'base_address', type: 'varchar', length: 255, nullable: true })
  baseAddress!: string | null;

  @Column({ name: 'service_radius_km', type: 'smallint', default: 5 })
  serviceRadiusKm!: number;

  @Column({ name: 'verification_status', type: 'varchar', length: 20, default: 'PENDING' })
  verificationStatus!: VerificationStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'rating_avg', type: 'numeric', precision: 3, scale: 2, default: 0 })
  ratingAvg!: string;

  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount!: number;

  @Column({ name: 'is_online', type: 'boolean', default: false })
  isOnline!: boolean;

  @Column({ name: 'last_active_at', type: 'timestamptz', nullable: true })
  lastActiveAt!: Date | null;

  @OneToMany(() => Certification, (cert) => cert.ktv)
  certifications?: Certification[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
