import { toSlug } from './slug.util';

describe('toSlug', () => {
  it('bỏ dấu tiếng Việt', () => {
    expect(toSlug('Nguyễn Thị Hồng Ánh')).toBe('nguyen-thi-hong-anh');
  });

  it('chuyển đ/Đ thành d', () => {
    expect(toSlug('Đỗ Văn Đức')).toBe('do-van-duc');
  });

  it('gộp ký tự đặc biệt thành một gạch nối và cắt gạch thừa ở hai đầu', () => {
    expect(toSlug('  Trần   A.B/C!! ')).toBe('tran-a-b-c');
  });
});
