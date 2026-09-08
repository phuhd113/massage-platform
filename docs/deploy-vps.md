# Deploy masgo.vn lên VPS

Hướng dẫn triển khai lần đầu: VPS Ubuntu + Docker Compose + Caddy, DNS ở Cloudflare,
web ở `masgo.vn` và API ở `api.masgo.vn`.

**Đọc mục 0 trước.** Bốn lỗi ở đó đều hỏng *im lặng* — app chạy, log sạch, HTTP 200 —
nên nếu chưa sửa thì chúng chỉ lộ ra khi đã có khách thật.

---

## 0. Bốn thứ phải có trong code trước khi deploy

Cả bốn đã được sửa trong cùng đợt tạo tài liệu này. Kiểm lại bằng:

```bash
# 1. NEXT_PUBLIC_API_BASE_URL phải là build arg, không chỉ biến lúc chạy.
#    Thiếu -> trình duyệt khách gọi localhost:5080 -> nút "Gọi ngay" chết hoàn toàn.
grep -c 'ARG NEXT_PUBLIC_API_BASE_URL' apps/web/Dockerfile        # phải là 1

# 2. Cors__Origins phải được khai. Thiếu -> CorsSetup fallback về localhost:3000
#    và trình duyệt chặn /leads, /views, /reports.
grep -c 'Cors__Origins__0' docker-compose.prod.yml                # phải là 1

# 3. UseForwardedHeaders. Thiếu -> API thấy IP của Caddy cho mọi khách:
#    rate limit khoá cả sàn, và gộp lead/view/report trùng sập thành một nhóm.
grep -c 'app.UseForwardedHeaders' src/Massage.Api/Program.cs      # phải là 1

# 4. .dockerignore phải loại .env*. Build context của API là gốc repo, nên
#    .env.production sẽ nằm trong layer image nếu không loại trừ.
grep -c '^\.env\.\*' .dockerignore                                # phải là 1
```

Ngoài ra `Program.cs` **từ chối khởi động** nếu `Otp:StubEnabled=true` ở Production —
stub trả mã OTP thẳng trong response, nên bật nó nghĩa là ai biết số điện thoại đều
chiếm được tài khoản đó, kể cả ADMIN.

---

## 1. Chuẩn bị VPS

Ubuntu 22.04/24.04, tối thiểu 4GB RAM và 40GB đĩa.

```bash
# Tạo user thường, thêm vào sudo
adduser masgo && usermod -aG sudo masgo

# Từ MÁY CỦA BẠN: copy SSH key lên
ssh-copy-id masgo@<IP-VPS>

# Tắt đăng nhập bằng mật khẩu và bằng root
sudo nano /etc/ssh/sshd_config
#   PermitRootLogin no
#   PasswordAuthentication no
sudo systemctl restart ssh
```

**Đừng đóng phiên SSH hiện tại** cho tới khi đã mở được một phiên mới bằng key — sai một
dòng trong `sshd_config` là tự khoá mình ra khỏi máy.

```bash
sudo timedatectl set-timezone Asia/Ho_Chi_Minh

# Swap 2GB. Build Next.js trên VPS 4GB có thể chạm trần bộ nhớ và bị OOM killer giết
# giữa chừng — lỗi hiện ra dưới dạng "npm run build" bị kill không rõ lý do, rất dễ
# tưởng là lỗi code.
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 2. Cài Docker

Dùng script chính thức của Docker. **Không** dùng `docker.io` của apt Ubuntu — bản cũ và
thiếu compose v2.

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

docker --version && docker compose version
```

## 3. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

> **CẢNH BÁO — ufw KHÔNG chặn được cổng đã publish trong compose.**
>
> `ports:` trên Docker Linux ghi luật DNAT vào iptables ở chain PREROUTING, **trước**
> chain mà ufw kiểm soát. `ufw deny 5432` sẽ báo "đã chặn" trong khi cổng vẫn mở ra
> internet. Đây chính là lý do `docker-compose.prod.yml` không publish cổng nào của
> postgres/redis/api/web — chỉ Caddy mở 80 và 443.
>
> Kiểm chứng **từ một máy khác** (không phải từ VPS):
> ```bash
> nc -zv <IP-VPS> 5432   # phải timeout / refused
> nc -zv <IP-VPS> 6379   # phải timeout / refused
> nc -zv <IP-VPS> 443    # phải succeeded
> ```

## 4. DNS ở Cloudflare

**Bắt đầu bước này sớm nhất có thể** — chuyển nameserver mất 15 phút đến 24 giờ, và mọi
thứ từ TLS đến R2 custom domain đều chờ nó.

1. Tạo tài khoản Cloudflare, **Add a site** → `masgo.vn` → chọn gói Free.
2. Cloudflare cấp một cặp nameserver. Vào trang quản trị PA Vietnam, đổi nameserver của
   domain sang cặp đó.
3. Chờ, rồi kiểm:
   ```bash
   dig NS masgo.vn +short     # phải trả nameserver của Cloudflare
   ```
4. Trong Cloudflare → **DNS** → thêm bốn bản ghi, tất cả trỏ về IP VPS:

   | Type | Name     | Content    | Proxy status          |
   |------|----------|------------|-----------------------|
   | A    | `@`      | `<IP-VPS>` | **DNS only** (xám)    |
   | A    | `api`    | `<IP-VPS>` | **DNS only** (xám)    |
   | A    | `www`    | `<IP-VPS>` | **DNS only** (xám)    |
   | A    | `status` | `<IP-VPS>` | **DNS only** (xám)    |

   `status` là dashboard giám sát hạ tầng (Beszel, mục 12) — dựng cùng lúc với ba bản ghi
   kia cho đỡ phải quay lại Cloudflare lần hai, dù container của nó tới mục 12 mới chạy.

### Proxy hay DNS-only — quyết định quan trọng

- **Deploy lần đầu: DNS only cho cả ba.** Caddy cần xin chứng chỉ qua HTTP-01, và bật
  proxy ngay từ đầu làm việc chẩn đoán khó hơn nhiều — mọi lỗi đều trông giống nhau từ
  bên ngoài.
- **Sau khi HTTPS chạy ổn**, có thể bật proxy (đám mây cam) cho `masgo.vn` và `www` để có
  CDN và chống DDoS. Khi đó **bắt buộc** đặt SSL/TLS mode = **Full (strict)**. Để
  "Flexible" nghĩa là Cloudflare gọi về VPS bằng HTTP thuần → vòng lặp redirect, và cookie
  phiên có `secure` nên đăng nhập hỏng.
- **KHÔNG bật proxy cho `api.masgo.vn`.** Cloudflare proxy đổi IP nguồn thành IP của
  Cloudflare, nên `ForwardedHeaders__KnownNetworks` không còn đủ — API sẽ thấy IP
  Cloudflare cho mọi khách, đúng lại vấn đề mà `UseForwardedHeaders` vừa sửa. Muốn bật thì
  phải đọc header `CF-Connecting-IP` và mở rộng danh sách proxy tin cậy sang dải IP
  Cloudflare; đó là một thay đổi code riêng.

Kiểm trước khi sang bước 6:
```bash
dig +short masgo.vn
dig +short api.masgo.vn
```
Cả hai phải trả đúng IP VPS. **Caddy xin chứng chỉ khi DNS chưa tới sẽ thất bại và đốt
hạn mức Let's Encrypt** (5 chứng chỉ trùng tên miền mỗi 7 ngày).

### Bản ghi email nằm ở tài liệu riêng

Hộp thư `@masgo.vn` chạy trên Email Server của P.A Việt Nam, **không** trên VPS này — cụm
MX/CNAME/TXT của nó khai ở `docs/email-server-setup.md`. Ba điều đáng biết ngay ở đây:

- **Thêm MX không ảnh hưởng gì tới bốn bản ghi A ở trên.** Web và email là hai đường độc
  lập; A record phục vụ trình duyệt, MX phục vụ mail server.
- **Hai CNAME `mail` và `mx` phải để DNS only**, cùng lý do kỹ thuật với `api` ở trên
  nhưng hậu quả khác: Cloudflare chỉ proxy được HTTP/HTTPS, nên bật proxy sẽ khiến
  SMTP/IMAP trỏ vào IP Cloudflare và không kết nối được.
- **`ACME_EMAIL=ban@masgo.vn` ở mục 5 là một hộp thư phải tồn tại thật.** Chưa dựng email
  server thì địa chỉ đó không nhận được gì, và cảnh báo "chứng chỉ sắp hết hạn mà chưa gia
  hạn được" của Let's Encrypt rơi vào hư vô — Caddy vẫn chạy bình thường nên không có gì
  báo cho biết là mình đang không được cảnh báo.

## 5. Clone repo và tạo cấu hình

```bash
git clone <URL-repo> ~/masgo && cd ~/masgo

cp .env.production.example .env.production
chmod 600 .env.production

# Sinh secret
openssl rand -base64 48    # -> JWT_SECRET
openssl rand -base64 32    # -> POSTGRES_PASSWORD

nano .env.production       # điền hết các dòng "BẮT BUỘC"
```

Nếu chưa nối R2 custom domain, tạm để `R2_PUBLIC_BASE_URL` là URL r2.dev hiện có — sẽ
sửa ở mục 8.

## 6. Build và khởi động

```bash
cd ~/masgo
C="docker compose -f docker-compose.prod.yml --env-file .env.production"

$C build                          # lần đầu 10–25 phút
$C up -d postgres redis
$C ps                             # chờ cả hai (healthy)
```

**Migrate TRƯỚC khi khởi động api:**

```bash
$C run --rm api migrate
$C run --rm api seed-areas        # 63 tỉnh + 696 quận, vài phút
$C run --rm api seed-services
$C run --rm api seed-packages
```

> Vì sao thứ tự này: container `api` tự khởi động Hangfire, mà Hangfire tạo schema
> `hangfire` lúc khởi động. Chạy đồng thời với migrate là hai hệ thống đổi schema cùng
> lúc. `run --rm api migrate` có tham số dòng lệnh nên Hangfire **không** chạy —
> `Program.cs` cố ý làm vậy.

```bash
$C up -d
$C logs -f caddy                  # theo dõi xin chứng chỉ, 30 giây – 2 phút
```

Tìm dòng `certificate obtained successfully`. Nếu thấy lỗi liên quan tới DNS thì quay lại
mục 4 — **đừng thử lại nhiều lần**, mỗi lần thất bại vẫn tính vào hạn mức Let's Encrypt.

```bash
curl -I https://masgo.vn
```

## 7. Tạo tài khoản ADMIN đầu tiên

Không có endpoint tự phong quyền admin — cố ý.

```bash
# 1. Đăng ký qua giao diện: https://masgo.vn/dang-ky (dùng số điện thoại thật)
# 2. Nâng quyền:
$C exec postgres psql -U massage -d massage_platform \
  -c "UPDATE users SET role='ADMIN' WHERE phone='0987654321'"

# 3. Kiểm
$C exec postgres psql -U massage -d massage_platform \
  -c "SELECT phone, role FROM users WHERE role='ADMIN'"
```

**Đăng xuất rồi đăng nhập lại.** JWT cũ mang vai trò cũ và sống 7 ngày.

Sau đó kiểm `https://masgo.vn/admin` và `https://api.masgo.vn/hangfire` đều mở được.

## 8. Cloudflare R2 — custom domain và WAF (BẮT BUỘC)

Đây là lúc duy nhất làm được, vì DNS vừa chuyển sang Cloudflare.

Làm theo `docs/cloudflare-r2-setup.md` mục 3 và 4. Tóm tắt các điểm không được bỏ:

1. R2 → bucket → **Settings → Custom Domains** → thêm `cdn.masgo.vn`.
2. **Tắt Public Development URL (r2.dev).** Để mở thì WAF rule vô nghĩa — vẫn còn một
   đường vòng tới đúng những file cần chặn.
3. Tạo **WAF Custom Rule** chặn `/certifications/` và `/identity/` (expression có sẵn
   trong `docs/cloudflare-r2-setup.md`, đổi host thành `cdn.masgo.vn`), action **Block**.
4. Sửa `.env.production`: `R2_PUBLIC_BASE_URL=https://cdn.masgo.vn`
5. **Bắt buộc rebuild web** — `remotePatterns` chốt lúc build:
   ```bash
   $C up -d --build web
   $C up -d api
   ```
6. Kiểm chứng:
   ```bash
   cd ~/masgo
   COMPOSE_FILE=docker-compose.prod.yml COMPOSE_ENV_FILES=.env.production \
     API=https://api.masgo.vn/api/v1 WEB=https://masgo.vn bash tools/verify-r2.sh
   ```

   Hai biến `COMPOSE_*` là **bắt buộc trên production**: script gọi `docker compose` trần,
   không kèm `-f`, nên thiếu chúng là nó soi nhầm stack dev hoặc không thấy container nào.

   Script tự chọn đường tạo tài khoản — thử `/auth/register` (mật khẩu) trước rồi mới rơi
   về OTP cho môi trường dev, vì production cố ý tắt OTP stub nên đường OTP luôn trả 503.

   **Script không tự dọn file test khỏi bucket** (nó nói rõ ở dòng cuối). Xoá trong R2
   dashboard, hoặc bằng boto3 — lưu ý image `amazon/aws-cli` **không chạy** trên VPS này
   (`Fatal glibc error: CPU does not support x86-64-v2`), dùng `python:3.12-alpine` thay thế.

> **Đã hoàn thành 2026-09-07.** Trước đó, vì còn dùng `r2.dev` (không đặt WAF rule được),
> ảnh CCCD và chứng chỉ **tải được công khai bởi ai có key**. Nay đã đo bằng key thật của
> một file vừa upload: 403 qua `cdn.masgo.vn`, 401 qua `r2.dev` cũ (đã tắt), và URL ký hạn
> 15 phút vẫn 200. Nếu dựng lại môi trường mới, đừng mời KTV thật tải giấy tờ lên trước khi
> bước này xong.

## 9. Kiểm chứng

Chạy từ **máy ngoài VPS** — từ VPS không kiểm được firewall và DNS công khai.

```bash
# TLS và redirect
curl -sI http://masgo.vn        | head -3    # 308 -> https
curl -sI https://masgo.vn       | head -3    # 200
curl -sI https://www.masgo.vn   | head -3    # 301 -> https://masgo.vn
curl -s  https://api.masgo.vn/api/v1/health  # {"status":"ok","database":"up","postgis":"3.4..."}

# Chứng chỉ thật, không phải staging
echo | openssl s_client -connect masgo.vn:443 -servername masgo.vn 2>/dev/null \
  | openssl x509 -noout -issuer -dates
# Issuer phải là Let's Encrypt, KHÔNG có chữ (STAGING)
```

**SSR thật sự render** — luôn kiểm bằng HTML thô, không bằng DevTools (DevTools hiển thị
DOM sau khi JS chạy nên trang client-render vẫn trông ổn):

```bash
U=https://masgo.vn/massage-tan-noi/ho-chi-minh/quan-7
curl -s "$U" | grep -c 'application/ld+json'          # > 0
curl -s "$U" | grep -o '<link rel="canonical"[^>]*>'  # href phải là https://masgo.vn/...
```

Thấy `localhost:3000` trong canonical nghĩa là `SITE_URL` sai **lúc build** → sửa
`.env.production` rồi `up -d --build web`.

**robots.txt và sitemap.xml phải cùng host:**
```bash
curl -s https://masgo.vn/robots.txt | grep Sitemap
curl -s https://masgo.vn/sitemap.xml | grep -o '<loc>[^<]*' | head -3
```

**CORS preflight** (lỗi chặn #2):
```bash
curl -si -X OPTIONS https://api.masgo.vn/api/v1/leads \
  -H 'Origin: https://masgo.vn' \
  -H 'Access-Control-Request-Method: POST' | grep -i access-control-allow-origin
# phải trả: Access-Control-Allow-Origin: https://masgo.vn

# Origin lạ KHÔNG được cấp quyền:
curl -si -X OPTIONS https://api.masgo.vn/api/v1/leads \
  -H 'Origin: https://ke-xau.example' \
  -H 'Access-Control-Request-Method: POST' | grep -ci access-control-allow-origin
# phải là 0
```

**OTP đã bị chặn:**
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://api.masgo.vn/api/v1/auth/otp/request \
  -H 'Content-Type: application/json' -d '{"phone":"0900000000"}'
# phải là 503, và response không chứa debugCode
```

**Nút "Gọi ngay" thật sự lấy được số** (lỗi chặn #1) — kiểm bằng trình duyệt thật: mở một
hồ sơ KTV, bật DevTools → Network, bấm "Gọi ngay". Request phải đi tới `api.masgo.vn`
(**không phải** `localhost:5080`) và response chứa số điện thoại.

**X-Forwarded-For hoạt động** (lỗi chặn #3) — cách duy nhất chứng minh rate limit không
sập chung một phân vùng. Gọi `/leads` từ hai mạng khác nhau (vd máy tính và điện thoại
dùng 4G), rồi trên VPS:

```bash
$C exec postgres psql -U massage -d massage_platform \
  -c "SELECT ip_address, created_at FROM leads ORDER BY created_at DESC LIMIT 5"
```

Phải thấy **hai IP công khai khác nhau**. Nếu mọi dòng đều là `172.28.x.x` thì
`DOCKER_SUBNET` không khớp `ipam.config.subnet` — kiểm lại cả hai chỗ.

**Hangfire:** đăng nhập ADMIN, mở `https://api.masgo.vn/hangfire`. Phải thấy 5 recurring
job, và `promotion:expire-sweep` (mỗi phút) đã chạy thành công ít nhất một lần. Kiểm giờ
hiển thị đúng múi giờ Việt Nam.

## 10. Backup

```bash
chmod +x tools/backup-db.sh
bash tools/backup-db.sh          # chạy tay một lần trước

crontab -e
# 0 3 * * * cd /home/masgo/masgo && bash tools/backup-db.sh >> /var/log/masgo-backup.log 2>&1
```

Hai việc không được bỏ:

- **Đẩy backup ra khỏi VPS.** Backup nằm cùng máy với DB thì một VPS hỏng là mất cả hai.
  Dùng `rclone` sang R2 (một bucket **khác**, không phải bucket ảnh) hoặc `scp` về máy.
- **Thử khôi phục một lần** vào một database tạm trước khi tin vào nó. Backup chưa từng
  khôi phục thử không phải backup, chỉ là một file.

## 11. Vận hành hằng ngày

```bash
cd ~/masgo
C="docker compose -f docker-compose.prod.yml --env-file .env.production"

$C ps                      # trạng thái
$C logs -f api             # log
$C logs --tail=100 web

# Deploy bản mới
git pull
$C build
$C run --rm api migrate    # nếu có migration mới
$C up -d

# Dọn image cũ — mỗi build .NET và Next để lại layer, VPS 40GB đầy nhanh
docker image prune -f
```

### Cạm bẫy khi deploy bản mới

- **`docker compose build` có thể báo "Built" trong khi publish đã fail**, và container
  tiếp tục chạy image cũ. Kiểm bằng thời điểm file, đừng tin dòng "Built":
  ```bash
  $C exec api stat -c %y /app/Massage.Api.dll
  ```
  `--no-cache` là cách thấy lỗi biên dịch thật.

- **Đổi `SITE_URL`, `API_BASE_URL_PUBLIC` hoặc `R2_PUBLIC_BASE_URL` phải
  `up -d --build web`** — restart không đủ, cả ba được chốt vào bản build.

- **Sửa `Caddyfile` phải `up -d --force-recreate caddy`**, không phải `caddy reload`.
  `git pull` ghi file mới bằng cách thay inode, mà bind mount đã gắn vào inode cũ — nên
  container vẫn thấy nội dung cũ và `caddy reload` trả về `"config is unchanged"`, nghe
  như đã áp dụng xong trong khi chưa đổi gì. `up -d caddy` trần cũng không đủ: Compose
  thấy service không đổi nên báo `Running` rồi bỏ qua. Kiểm bằng cách so hai bên:
  ```bash
  grep -c status Caddyfile                                  # trên đĩa
  docker exec masgo_caddy grep -c status /etc/caddy/Caddyfile   # trong container
  ```

- **Đổi `DOCKER_SUBNET` phải đổi ở cả hai chỗ** (`ipam` trong compose và
  `.env.production`) trong cùng một lần. Lệch nhau là mất IP thật của khách, và hỏng
  lặng lẽ.

- **Chạy `docker compose down` sẽ xoá mạng và Docker cấp subnet mới khi tạo lại** — nếu
  không ghim `ipam` thì `ForwardedHeaders` tự hỏng sau lần restart đó. File compose đã
  ghim sẵn; đừng gỡ.

## 12. Giám sát hạ tầng (Beszel)

Dashboard CPU/RAM/disk/uptime của VPS và từng container, ở `https://status.masgo.vn`. Auth
**riêng** với app — tài khoản tạo trong chính Beszel, không liên quan role ADMIN.

```bash
cd ~/masgo
C="docker compose -f docker-compose.prod.yml --env-file .env.production"

# 1. Chỉ dựng hub trước. Agent cần TOKEN chưa tồn tại nên đừng bật cùng lúc.
$C up -d beszel
$C logs -f caddy       # chờ Caddy xin xong chứng chỉ cho status.masgo.vn
```

2. Mở `https://status.masgo.vn`, tạo tài khoản admin đầu tiên của Beszel.
3. Trong giao diện: **Add System**, tab **Docker**:
   - **Tên**: tuỳ ý (vd `masgo-vps`)
   - **Máy chủ / IP**: `beszel-agent` — tên service trong network `internal`, **không phải**
     IP công khai của VPS. Agent không mở port nào ra ngoài (xem ghi chú trong
     `docker-compose.prod.yml` về lý do tránh `network_mode: host`).
   - **Cổng**: để nguyên `45876`

   Bấm **Thêm Hệ thống**, rồi copy **cả hai** giá trị "Khoá" và "Token" trong dialog.
4. Dán vào `.env.production`:
   ```bash
   nano .env.production
   #   BESZEL_AGENT_TOKEN=<token>
   #   BESZEL_AGENT_KEY="ssh-ed25519 AAAA..."
   ```

   > **Phải có cả hai.** Agent load public key **trước** khi xét chế độ token, nên thiếu
   > `KEY` thì nó restart-loop với `no key provided` dù URL và token đều đúng — thông báo
   > lỗi đọc như sai token, trong khi token không liên quan gì. Đã cắn.
   >
   > Nếu lỡ đóng dialog trước khi copy, lấy lại từ chính hub:
   > ```bash
   > # Token:
   > docker run --rm -v masgo_beszel_data:/d alpine sh -c \
   >   'apk add -q sqlite; sqlite3 /d/data.db "SELECT token FROM fingerprints;"'
   > # Khoá công khai (derive từ private key hub sinh lúc chạy lần đầu):
   > docker run --rm -v masgo_beszel_data:/d alpine sh -c \
   >   'apk add -q openssh-keygen; cp /d/id_ed25519 /tmp/k; chmod 600 /tmp/k; ssh-keygen -y -f /tmp/k'
   > ```
5. Khởi động agent:
   ```bash
   $C up -d beszel-agent
   ```
6. Trong giao diện Beszel, system vừa thêm phải chuyển từ "pending" sang "up" trong vài
   giây. Thấy CPU/RAM/disk của VPS và danh sách container (postgres/redis/api/web/caddy)
   kèm trạng thái từng cái.

**Không cần mở port nào ở firewall cho việc này** — agent chỉ nói chuyện với hub qua
network `internal`, và hub ra ngoài qua Caddy như mọi site khác. `ufw status` không cần
đổi gì.

---

## Còn nợ, và cố ý

- **VNPay chưa có credential.** Đường nạp tiền báo lỗi rõ ràng khi bấm, app vẫn chạy.
  Khi có: điền `VNPAY_*`, đổi `VNPAY_PAYMENT_URL` sang bản production, và khai lại IPN URL
  trong trang quản trị VNPay — cấu hình sandbox **không** tự chuyển sang. Xem
  `docs/vnpay-setup.md`.
- **Zalo ZNS chưa có** (cần giấy phép kinh doanh). Đường OTP tắt, đăng nhập bằng mật khẩu.
  Khi có: điền `ZALO_ZNS_*`, giữ nguyên `Otp__StubEnabled=false`, rebuild api.
- **Quên mật khẩu chưa làm** — kênh reset khả thi duy nhất là OTP hoặc email, cả hai chưa
  chạy. Admin reset bằng SQL:
  ```sql
  UPDATE users SET password_hash = NULL, locked_until = NULL WHERE phone = '0...';
  ```
  rồi người dùng tự đặt lại ở `/tai-khoan`.
