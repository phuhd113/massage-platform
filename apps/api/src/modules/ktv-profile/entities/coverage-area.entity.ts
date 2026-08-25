import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('coverage_areas')
export class CoverageArea {
  @PrimaryColumn({ name: 'ktv_id', type: 'uuid' })
  ktvId!: string;

  @PrimaryColumn({ name: 'area_id', type: 'uuid' })
  areaId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
