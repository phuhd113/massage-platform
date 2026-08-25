import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AreaLevel = 'PROVINCE' | 'DISTRICT' | 'WARD';

@Entity('administrative_areas')
export class AdministrativeArea {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 160 })
  slug!: string;

  @Column({ type: 'varchar', length: 20 })
  level!: AreaLevel;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => AdministrativeArea, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: AdministrativeArea | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
