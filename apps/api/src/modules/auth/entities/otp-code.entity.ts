import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type OtpPurpose = 'REGISTER' | 'LOGIN';

@Entity('otp_codes')
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 15 })
  phone!: string;

  @Column({ name: 'code_hash', type: 'text' })
  codeHash!: string;

  @Column({ type: 'varchar', length: 20, default: 'REGISTER' })
  purpose!: OtpPurpose;

  @Column({ type: 'smallint', default: 0 })
  attempts!: number;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
