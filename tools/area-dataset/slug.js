// Bản sao SlugHelper.ToSlug — đ/Đ thay tay trước, rồi NFD + bỏ NonSpacingMark.
function toSlug(input){
  const n = input.replace(/đ/g,'d').replace(/Đ/g,'D').normalize('NFD');
  const stripped = [...n].filter(ch=>!/\p{Mn}/u.test(ch)).join('');
  let s = stripped.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  if (s.length>120) s = s.slice(0,120).replace(/-+$/,'');
  return s;
}
module.exports={toSlug};
