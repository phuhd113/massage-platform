const fs=require('fs');
const {toSlug}=require('./slug.js');
const src=JSON.parse(fs.readFileSync('vn-raw.json','utf8'));

// Slug đã được index trước khi mở toàn quốc. Tên chuẩn trong dataset sinh ra slug
// khác, nên giữ nguyên slug cũ và chỉ lấy code/name — đổi ba slug này là mất URL
// đã có thứ hạng, tức mất đúng thứ mà việc chọn cơ cấu hành chính cũ sinh ra để
// bảo vệ. Khoá theo code để không khớp nhầm theo tên.
const SLUG_OVERRIDE = { 'P:79':'tp-ho-chi-minh', 'P:01':'ha-noi', 'D:769':'tp-thu-duc' };

const pad=(c,n)=>String(c).padStart(n,'0');
const out=[]; const wardFixes=[];
for(const p of src){
  const pcode=pad(p.code,2);
  const prov={code:pcode,name:p.name,slug:SLUG_OVERRIDE['P:'+pcode]??toSlug(p.name),districts:[]};
  for(const d of p.districts){
    const dcode=pad(d.code,3);
    const dist={code:dcode,name:d.name,slug:SLUG_OVERRIDE['D:'+dcode]??toSlug(d.name),wards:[]};
    // Slug phường chỉ là định danh, không vào URL nào. Bỏ dấu làm vài cặp phường
    // khác nhau thật sự đụng nhau trong cùng quận ("Sa Pa" / "Sa Pả", "Hoằng Phú"
    // / "Hoằng Phụ"), nên bản sau lấy thêm mã GSO làm hậu tố. Mã là bất biến của
    // dataset nên slug ổn định qua mọi lần seed lại.
    const seen=new Map();
    for(const w of d.wards){
      const base=toSlug(w.name); const wcode=pad(w.code,5);
      let slug=base;
      if(seen.has(base)){ slug=base+'-'+wcode; wardFixes.push(p.name+' / '+d.name+': '+w.name+' -> '+slug); }
      else seen.set(base,wcode);
      dist.wards.push({code:wcode,name:w.name,slug});
    }
    prov.districts.push(dist);
  }
  out.push(prov);
}

// Kiểm đúng các bất biến mà uq_area_root_slug / uq_area_parent_slug / uq_area_code
// sẽ ép ở tầng DB. Bắt ở đây thì thấy tên cụ thể; bắt lúc seed chỉ thấy 23505.
const errs=[]; const rootSlugs=new Set(), lvlCodes={P:new Set(),D:new Set(),W:new Set()};
for(const p of out){
  if(rootSlugs.has(p.slug)) errs.push('tỉnh trùng slug: '+p.slug); rootSlugs.add(p.slug);
  if(lvlCodes.P.has(p.code)) errs.push('tỉnh trùng code: '+p.code); lvlCodes.P.add(p.code);
  const ds=new Set();
  for(const d of p.districts){
    if(ds.has(d.slug)) errs.push('quận trùng slug trong '+p.name+': '+d.slug); ds.add(d.slug);
    if(lvlCodes.D.has(d.code)) errs.push('quận trùng code: '+d.code); lvlCodes.D.add(d.code);
    const ws=new Set();
    for(const w of d.wards){
      if(ws.has(w.slug)) errs.push('phường trùng slug trong '+d.name+' / '+p.name+': '+w.slug); ws.add(w.slug);
      if(lvlCodes.W.has(w.code)) errs.push('phường trùng code: '+w.code); lvlCodes.W.add(w.code);
    }
  }
}
console.log('provinces',out.length,'districts',lvlCodes.D.size,'wards',lvlCodes.W.size);
console.log('slug phường phải thêm hậu tố mã:',wardFixes.length);
wardFixes.forEach(f=>console.log('   '+f));
if(errs.length){ console.log('VI PHẠM ('+errs.length+'):'); errs.slice(0,40).forEach(e=>console.log('  '+e)); process.exit(1); }
console.log('OK: không vi phạm ràng buộc nào');
fs.writeFileSync('vietnam-areas.json', JSON.stringify(out));
console.log('size', (fs.statSync('vietnam-areas.json').size/1048576).toFixed(2),'MB');
