// Sinh Data/SeedData/vietnam-area-centroids.json — toạ độ tâm của 63 tỉnh và 696
// quận/huyện, khoá theo mã GSO của vietnam-areas.json.
//
//   curl -sL "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_VNM_2.json.zip" -o gadm2.zip
//   unzip -o gadm2.zip && node centroids.js
//
// Vì sao lấy từ GADM chứ không từ provinces.open-api.vn: nguồn đang dùng cho
// vietnam-areas.json không có hình học. GADM 4.1 có polygon cấp 2 theo đúng cơ cấu
// **trước sáp nhập** — cùng cơ cấu mà dataset này cố ý giữ.
//
// GADM không mang mã GSO (CC_2 toàn "NA"), nên khớp phải dựa vào tên. Tên GADM viết
// dính liền không dấu cách ("AnPhú") và không có tiền tố loại đơn vị, nên chuỗi khớp
// bỏ hết dấu gạch và thử cả bản có/không tiền tố. Cách này khớp 678/696 quận; phần
// còn lại nằm ở DISTRICT_OVERRIDE bên dưới, có lý do từng dòng.
const fs = require('fs');
const path = require('path');
const { toSlug } = require('./slug.js');

const AREAS = path.join(__dirname, '../../src/Massage.Api/Data/SeedData/vietnam-areas.json');
const OUT = path.join(__dirname, '../../src/Massage.Api/Data/SeedData/vietnam-area-centroids.json');

// GADM 4.1 chụp năm 2022, dataset hành chính của ta mới hơn. Chín quận dưới đây là
// chênh lệch thật giữa hai thời điểm, không phải lỗi khớp tên — mỗi dòng ghi rõ lý do.
// Giá trị null nghĩa là **cố ý không có centroid**: hai huyện đảo Hoàng Sa/Trường Sa
// không có polygon trong GADM, và đoán toạ độ cho chúng còn tệ hơn để trống.
// Khoá là "<mã tỉnh>:<mã quận>" đúng như trong vietnam-areas.json (mã giữ số 0 đứng
// đầu). Dùng cặp mã chứ không dùng riêng mã quận vì mã quận và mã phường đụng nhau
// trong dữ liệu thật — cùng lý do ràng buộc DB là (level, code).
const DISTRICT_OVERRIDE = {
  // Quảng Hoà lập năm 2020 từ Quảng Uyên + Phục Hoà; lấy tâm Quảng Uyên (phần lớn hơn).
  '04:049': 'QuảngUyên',
  // Thị xã Chũ lập 2024 tách từ huyện Lục Ngạn.
  '24:224': 'LụcNgạn',
  // Thị xã Nghi Sơn lập 2020 từ huyện Tĩnh Gia (đổi tên, cùng địa bàn).
  '38:407': 'TĩnhGia',
  // Huế tách thành hai quận năm 2025 từ TP Huế cũ: Thuận Hoá (bờ nam) và Phú Xuân
  // (bờ bắc). GADM chỉ có polygon "Huế" nguyên khối, nên cả hai cùng nhận tâm đó.
  // Chấp nhận được vì hai quận này nằm sát nhau ngay trung tâm — sai số vài km trong
  // khi quận gần thứ hai (Hương Thuỷ, Hương Trà) cách xa hơn nhiều.
  '46:474': 'Huế',
  '46:475': 'Huế',
  // GADM viết "QuiNhơn", dataset của ta viết "Quy Nhơn" — cùng một nơi.
  '52:540': 'QuiNhơn',
  // Thị xã Phú Mỹ lập 2018 từ huyện Tân Thành (đổi tên, cùng địa bàn).
  '77:754': 'TânThành',
  // Huyện Long Đất lập 2024 từ Long Điền + Đất Đỏ; lấy tâm Long Điền.
  '77:753': 'LongĐiền',
  // Côn Đảo là huyện đảo, GADM cấp 2 không có polygon riêng cho nó. Toạ độ thị trấn
  // Côn Đảo, tra tay: đây là nơi duy nhất trên đảo có dân cư.
  '77:755': [106.6339, 8.6833],
  // Hai huyện đảo không có dân thường trú và không có polygon trong GADM. Để trống
  // có chủ đích: KTV không hành nghề ở đó, và toạ độ đoán sẽ hút nhầm khách ven biển.
  '48:498': null, // Hoàng Sa (Đà Nẵng)
  '56:576': null, // Trường Sa (Khánh Hoà)
};

// Tên tỉnh GADM còn theo trước 2025: Huế lúc đó là "Thừa Thiên Huế".
const PROVINCE_OVERRIDE = { '46': 'ThừaThiênHuế' };

const key = (s) => toSlug(s).replace(/-/g, '');
const PREFIX = /^(quan|huyen|thanhpho|thixa|tinh|tp)(?=.)/;
const variants = (s) => {
  const k = key(s);
  const out = [k];
  const stripped = k.replace(PREFIX, '');
  if (stripped && stripped !== k) out.push(stripped);
  return out;
};

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Tâm của một polygon/multipolygon, trung bình có trọng số theo diện tích từng mảnh.
 *
 * Cố ý KHÔNG lấy tâm bounding box: quận hình chữ L hay ôm bờ sông sẽ cho tâm rơi ra
 * ngoài địa phận, mà toàn bộ mục đích của cột này là "khách đang đứng ở quận nào".
 * Cũng không lấy centroid của mảnh lớn nhất một mình: Cần Giờ và các huyện ven biển
 * có nhiều mảnh, trọng số diện tích cho ra điểm hợp lý hơn.
 */
function centroidOf(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let sx = 0, sy = 0, sa = 0;
  for (const poly of polys) {
    const ring = poly[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      const cross = x1 * y2 - x2 * y1;
      a += cross;
      cx += (x1 + x2) * cross;
      cy += (y1 + y2) * cross;
    }
    a /= 2;
    if (a === 0) continue;
    const w = Math.abs(a);
    sx += (cx / (6 * a)) * w;
    sy += (cy / (6 * a)) * w;
    sa += w;
  }
  if (sa === 0) return null;
  return [round6(sx / sa), round6(sy / sa)];
}

/**
 * Gộp tâm các quận thành tâm tỉnh, thay vì tra riêng ở GADM cấp 1: hai cấp lấy từ hai
 * file khác nhau sẽ lệch nhau ở đúng những tỉnh có ranh giới đổi. Không cần trọng số
 * diện tích — tâm tỉnh chỉ được dùng khi khách ở xa mọi quận, tức lúc sai vài km
 * không đổi kết quả nào.
 */
function mergeCentroids(points) {
  const ok = points.filter(Boolean);
  if (!ok.length) return null;
  return [
    round6(ok.reduce((a, p) => a + p[0], 0) / ok.length),
    round6(ok.reduce((a, p) => a + p[1], 0) / ok.length),
  ];
}

function main() {
  const local = path.join(__dirname, 'gadm41_VNM_2.json');
  const gadmPath = fs.existsSync('gadm41_VNM_2.json') ? 'gadm41_VNM_2.json' : local;
  const gadm = JSON.parse(fs.readFileSync(gadmPath, 'utf8'));
  const ours = JSON.parse(fs.readFileSync(AREAS, 'utf8'));

  const byProvince = new Map();
  for (const f of gadm.features) {
    for (const v of variants(f.properties.NAME_1)) {
      if (!byProvince.has(v)) byProvince.set(v, []);
      byProvince.get(v).push(f);
    }
  }

  const out = [];
  const missed = [];
  let districtHits = 0, districtTotal = 0, intentionalNulls = 0;

  for (const p of ours) {
    const wanted = PROVINCE_OVERRIDE[p.code]
      ? [key(PROVINCE_OVERRIDE[p.code])]
      : variants(p.name);
    const features = wanted.map((v) => byProvince.get(v)).find(Boolean);
    if (!features) {
      missed.push('TỈNH ' + p.name);
      continue;
    }

    const index = new Map();
    for (const f of features) {
      for (const v of variants(f.properties.NAME_2)) if (!index.has(v)) index.set(v, f);
    }

    const districtCentroids = [];

    for (const d of p.districts) {
      districtTotal++;
      const overrideKey = p.code + ':' + d.code;
      let centroid = null;

      if (overrideKey in DISTRICT_OVERRIDE) {
        const ov = DISTRICT_OVERRIDE[overrideKey];
        if (ov === null) { intentionalNulls++; continue; }
        if (Array.isArray(ov)) {
          centroid = ov;
        } else {
          const f = index.get(key(ov));
          if (!f) {
            missed.push(p.name + ' / ' + d.name + ' (override "' + ov + '" không có trong GADM)');
            continue;
          }
          centroid = centroidOf(f.geometry);
        }
      } else {
        const hit = variants(d.name).map((v) => index.get(v)).find(Boolean);
        if (!hit) { missed.push(p.name + ' / ' + d.name); continue; }
        centroid = centroidOf(hit.geometry);
      }

      if (!centroid) { missed.push(p.name + ' / ' + d.name + ' (hình học rỗng)'); continue; }
      out.push({ level: 'DISTRICT', code: d.code, lon: centroid[0], lat: centroid[1] });
      districtCentroids.push(centroid);
      districtHits++;
    }

    const provinceCentroid = mergeCentroids(districtCentroids);
    if (provinceCentroid) {
      out.push({ level: 'PROVINCE', code: p.code, lon: provinceCentroid[0], lat: provinceCentroid[1] });
    } else {
      missed.push('TỈNH ' + p.name + ' (không quận nào có tâm)');
    }
  }

  console.log('quận có centroid: ' + districtHits + '/' + districtTotal +
    '  (bỏ trống có chủ đích: ' + intentionalNulls + ')');
  console.log('tổng số dòng xuất: ' + out.length);

  // Chặn toạ độ rơi ra ngoài lãnh thổ: một lỗi đảo lon/lat cho ra điểm giữa Ấn Độ
  // Dương mà vẫn là số hợp lệ, và cột này chỉ máy đọc nên sẽ không ai nhìn thấy.
  const outside = out.filter((r) => r.lon < 102 || r.lon > 110 || r.lat < 8 || r.lat > 24);
  if (outside.length) {
    console.log('TOẠ ĐỘ NGOÀI LÃNH THỔ (' + outside.length + '):');
    outside.slice(0, 20).forEach((r) => console.log('  ' + r.level + ' ' + r.code + ' ' + r.lon + ',' + r.lat));
    process.exit(1);
  }

  if (missed.length) {
    console.log('KHÔNG KHỚP (' + missed.length + '):');
    missed.forEach((m) => console.log('  ' + m));
    process.exit(1);
  }

  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('OK -> ' + OUT + '  ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
}

main();
