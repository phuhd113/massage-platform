import 'reflect-metadata';
import dataSource from '../data-source';
import { toSlug } from '../../modules/ktv-profile/slug.util';

/**
 * Seed tối thiểu cho Phase 0: hai đô thị lớn nơi sẽ chạy thử nghiệm đầu tiên.
 * Danh sách hành chính đầy đủ sẽ nạp ở Phase 1 khi geo-search đi vào hoạt động.
 */
const SEED: Record<string, string[]> = {
  'TP. Hồ Chí Minh': [
    'Quận 1',
    'Quận 3',
    'Quận 4',
    'Quận 5',
    'Quận 7',
    'Quận 10',
    'Quận Bình Thạnh',
    'Quận Phú Nhuận',
    'Quận Tân Bình',
    'Quận Gò Vấp',
    'TP. Thủ Đức',
  ],
  'Hà Nội': [
    'Quận Ba Đình',
    'Quận Hoàn Kiếm',
    'Quận Đống Đa',
    'Quận Hai Bà Trưng',
    'Quận Cầu Giấy',
    'Quận Thanh Xuân',
    'Quận Hoàng Mai',
    'Quận Long Biên',
    'Quận Nam Từ Liêm',
    'Quận Tây Hồ',
  ],
};

async function main() {
  await dataSource.initialize();

  for (const [province, districts] of Object.entries(SEED)) {
    const provinceSlug = toSlug(province);
    // ON CONFLICT giữ cho seed chạy lại nhiều lần mà không nhân bản dữ liệu.
    const [{ id: provinceId }] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO administrative_areas (name, slug, level)
       VALUES ($1, $2, 'PROVINCE')
       ON CONFLICT (slug, level) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [province, provinceSlug],
    );

    for (const district of districts) {
      await dataSource.query(
        `INSERT INTO administrative_areas (name, slug, level, parent_id)
         VALUES ($1, $2, 'DISTRICT', $3)
         ON CONFLICT (slug, level) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id`,
        [district, `${provinceSlug}-${toSlug(district)}`, provinceId],
      );
    }
    console.log(`Đã seed ${province}: ${districts.length} quận/huyện`);
  }

  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
