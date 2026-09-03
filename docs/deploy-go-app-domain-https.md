# Quy trình Deploy Go App + Domain + HTTPS

Tài liệu này mô tả end-to-end: tạo VPS, chạy app trong Docker, trỏ domain, rồi terminate TLS bằng Caddy. Mục tiêu cuối cùng là chỉ public **443**, app listen nội bộ **8787**.

Giá trị dùng trong setup thực tế:

| Mục | Giá trị |
|---|---|
| VPS | DigitalOcean, Ubuntu 24.04, 1 vCPU / 1 GB RAM |
| Public IP | `152.42.238.232` |
| Domain | `viet.it.com` (Namecheap) |
| API host | `api.viet.it.com` |
| App container | `demo-app-backend-1` |
| App port | `8787` |
| Reverse proxy | Caddy 2 trên Docker network `web` |
| SSH | `root@152.42.238.232` cổng `22` |

---

## Kiến trúc cuối cùng

```text
                         Internet
                            │
                            ▼
                  https://api.viet.it.com
                            │
                            ▼
                     Caddy :443
                     HTTP → HTTPS
                            │
                     Docker network `web`
                            │
                            ▼
              demo-app-backend-1:8787
                            │
                            ▼
                         Go App
```

Luồng production sau khi đóng port 8787:

```text
Internet
   │
   ├── ❌ :8787
   ├── ❌ :5432
   ├── ❌ :6379
   └── ✅ :443
          │
          ▼
        Caddy (Let's Encrypt)
          │
          ▼
        Go :8787  (chỉ trong Docker network)
```

**URL**

- API: `https://api.viet.it.com`
- Health: `https://api.viet.it.com/health`

---

## 1. Tạo VPS

Ví dụ DigitalOcean.

Chọn:

- OS: **Ubuntu 24.04**
- CPU: **1 vCPU**
- RAM: **1 GB**

Sau khi tạo VPS, ghi lại IP. Ví dụ:

```text
152.42.238.232
```

DigitalOcean thường hiện **password root** một lần (email / dashboard). Lưu lại. Lần SSH đầu có thể dùng password; sau đó nên chuyển sang **SSH key** (mục dưới).

Nếu khi tạo droplet đã dán SSH public key vào DigitalOcean thì login bằng key, không hỏi password.

---

## Hướng dẫn SSH

Mục này dùng cho máy local **Windows** (PowerShell / Windows Terminal) và VPS Ubuntu. macOS/Linux tương tự, path key là `~/.ssh/` thay vì `C:\Users\<user>\.ssh\`.

### Kiểm tra OpenSSH trên Windows

PowerShell:

```powershell
ssh -V
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH*'
```

Nếu chưa có client:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

### SSH lần đầu (password)

```bash
ssh root@152.42.238.232
```

Lần đầu hiện:

```text
The authenticity of host '152.42.238.232' can't be established.
ED25519 key fingerprint is SHA256:....
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Gõ `yes` → Windows ghi host vào `C:\Users\<user>\.ssh\known_hosts`.

Sau đó nhập **password root** (không hiện ký tự khi gõ, đó là bình thường). Enter.

Thoát session:

```bash
exit
```

**Timeout / Connection refused**

- Dashboard cloud: firewall phải **allow TCP 22** (DigitalOcean: Networking → Firewalls, hoặc droplet mặc định mở 22).
- Máy local/công ty chặn port 22: dùng VPN, hoặc đổi `Port` SSH (chỉ làm khi đã có console web dự phòng).
- IP sai hoặc droplet chưa boot xong.

### Tạo SSH key trên máy local

Chỉ tạo **một lần** trên laptop. Ed25519:

```powershell
ssh-keygen -t ed25519 -C "laptop-deploy" -f $env:USERPROFILE\.ssh\id_ed25519_vps
```

- Passphrase: nên đặt (bảo vệ private key nếu máy bị mất).
- Không ghi đè `id_ed25519` sẵn có trừ khi cố ý.

Kết quả:

| File | Vai trò | Đưa lên VPS? |
|---|---|---|
| `id_ed25519_vps` | **Private key** | **Không bao giờ** |
| `id_ed25519_vps.pub` | Public key | Có — vào `authorized_keys` |

Xem public key:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519_vps.pub
```

Dòng dạng:

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... laptop-deploy
```

### Copy public key lên VPS

**Cách A — còn login được bằng password** (Windows OpenSSH):

```powershell
type $env:USERPROFILE\.ssh\id_ed25519_vps.pub | ssh root@152.42.238.232 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Nhập password root một lần. Public key được append vào `/root/.ssh/authorized_keys`.

**Cách B — DigitalOcean dashboard:** Droplet → **Settings** → **Security** → add SSH key (dán nội dung `.pub`). Key gắn lúc **tạo** droplet thì user `root` đã có sẵn.

**Cách C — dán tay:** SSH password vào VPS, rồi:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

Dán **một dòng** public key, lưu. Rồi:

```bash
chmod 600 ~/.ssh/authorized_keys
```

### Login bằng key

```bash
ssh -i $env:USERPROFILE\.ssh\id_ed25519_vps root@152.42.238.232
```

Không hỏi password root (có thể hỏi passphrase của key).

Nếu vẫn hỏi password: key chưa vào `authorized_keys`, hoặc sai file `-i`, hoặc permission trên VPS (`~/.ssh` phải `700`, `authorized_keys` phải `600`, owner `root`).

### File config SSH (alias)

Tạo/sửa `C:\Users\<user>\.ssh\config`:

```sshconfig
Host viet-vps
    HostName 152.42.238.232
    User root
    IdentityFile ~/.ssh/id_ed25519_vps
    IdentitiesOnly yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

Từ đó chỉ cần:

```bash
ssh viet-vps
```

`ServerAliveInterval` giữ session không bị NAT/firewall cắt im lặng.

Quyền file config trên Windows: không share folder `.ssh`. Trên macOS/Linux: `chmod 600 ~/.ssh/config`.

### ssh-agent (passphrase)

Tránh gõ passphrase mỗi lần:

```powershell
Get-Service ssh-agent | Set-Service -StartupType Manual
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519_vps
```

### (Tuỳ chọn) Tắt login password — chỉ sau khi key đã work

Mở **một session SSH key thành công**, **giữ session đó**, terminal thứ hai mới sửa sshd.

Trên VPS:

```bash
sshd -T | grep -E 'passwordauthentication|permitrootlogin|pubkeyauthentication'
```

Sửa `/etc/ssh/sshd_config` (hoặc drop-in `/etc/ssh/sshd_config.d/*.conf`):

```text
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
```

Kiểm tra config rồi reload — **đừng disconnect session hiện tại trước khi test**:

```bash
sshd -t
systemctl reload ssh
```

Terminal mới:

```bash
ssh viet-vps
```

OK mới đóng session cũ. Nếu khóa nhầm: DigitalOcean **Access** → **Launch Droplet Console** (browser), bật lại `PasswordAuthentication yes`.

Khi `apt upgrade` hỏi `sshd_config`: chọn **keep the local version currently installed**.

### SCP / copy file

```bash
scp -i $env:USERPROFILE\.ssh\id_ed25519_vps .\docker-compose.yml viet-vps:/opt/demo-app/
```

Hoặc với alias:

```bash
scp .\docker-compose.yml viet-vps:/opt/demo-app/
```

### Lệnh hay dùng trên VPS

```bash
ssh viet-vps
hostname
ip a
exit
```

Chạy một lệnh rồi về local:

```bash
ssh viet-vps "docker ps && curl -sS http://127.0.0.1:8787/health"
```

### Lỗi thường gặp

| Hiện tượng | Hướng xử lý |
|---|---|
| `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED` | Droplet recreate, host key đổi. Xóa dòng IP trong `known_hosts` rồi SSH lại. Chỉ làm khi **bạn** vừa tạo lại VPS. |
| `Permission denied (publickey)` | Sai user, sai `-i`, public key chưa trong `authorized_keys`, hoặc permission `~/.ssh`. |
| `Connection timed out` | Firewall cloud/chặn port 22, IP sai, droplet off. |
| `Connection refused` | `sshd` chưa chạy; `systemctl status ssh`. |
| Hỏi password dù đã có key | Thiếu `IdentitiesOnly yes` + `IdentityFile`, hoặc agent đưa nhầm key. |

**Không** copy private key lên GitHub, vào image Docker, hay chat. Public key (`.pub`) thì được.

---

## 2. Update Ubuntu

```bash
apt update
apt upgrade -y
```

Nếu gặp:

```text
dpkg was interrupted
```

chạy:

```bash
dpkg --configure -a
```

Nếu Ubuntu hỏi về `/etc/ssh/sshd_config` **khi đang SSH trực tiếp vào server**, chọn:

```text
keep the local version currently installed
```

để không ghi đè cấu hình SSH hiện tại (tránh tự khóa session).

---

## 3. Cài Docker

```bash
curl -fsSL https://get.docker.com | sh
```

Kiểm tra:

```bash
docker --version
docker compose version
```

Test daemon:

```bash
docker run hello-world
```

Kỳ vọng container chạy xong, in message hello-world, rồi exit.

---

## 4. Clone source code

```bash
cd /opt
git clone <YOUR_GITHUB_REPO>
cd <PROJECT>
```

Ví dụ:

```bash
cd /opt
git clone https://github.com/xxx/demo-app.git
cd demo-app
```

---

## 5. Dockerize Go App

Cấu trúc project ví dụ:

```text
demo-app/
├── cmd/
│   └── server/
│       └── main.go
├── go.mod
├── go.sum
├── Dockerfile
└── docker-compose.yml
```

`Dockerfile`:

```dockerfile
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

FROM alpine:3.22

WORKDIR /app

COPY --from=builder /app/server .

EXPOSE 8787

CMD ["./server"]
```

Giai đoạn `builder` compile binary tĩnh (`CGO_ENABLED=0`). Image runtime chỉ chứa binary trên Alpine, nhỏ và không cần Go toolchain.

`docker-compose.yml` tối thiểu (giai đoạn test IP:8787):

```yaml
services:
  backend:
    build: .
    restart: unless-stopped
    ports:
      - "8787:8787"
```

Compose sẽ tạo container tên dạng `demo-app-backend-1` (tên thư mục + service + replica).

---

## 6. Go App phải listen đúng interface

Trong Go:

```go
http.ListenAndServe(":8787", router)
```

Không dùng:

```go
http.ListenAndServe("localhost:8787", router)
```

`localhost` / `127.0.0.1` chỉ bind loopback **trong container**. Caddy (container khác) không forward được vào đó. Bind `:8787` (tương đương `0.0.0.0:8787`) để nhận traffic từ Docker network.

Health endpoint nên rẻ, không auth, không leak secret. Ví dụ `GET /health` trả:

```json
{"status":"ok"}
```

---

## 7. Build và chạy Docker

```bash
docker compose up -d --build
```

Kiểm tra:

```bash
docker ps
```

Phải thấy container, ví dụ:

```text
demo-app-backend-1
```

Health ngay trên VPS (không qua Internet):

```bash
curl -i http://localhost:8787/health
```

Kỳ vọng **200 OK**.

Nếu fail:

1. `docker logs demo-app-backend-1 --tail 100`
2. Xác nhận process listen `:8787`, không phải `127.0.0.1:8787`
3. `docker compose ps` xem Exit / Restart loop

---

## 8. Test public IP

Khi compose còn map:

```yaml
ports:
  - "8787:8787"
```

test từ máy local:

```text
http://152.42.238.232:8787/health
```

hoặc:

```bash
curl -i http://152.42.238.232:8787/health
```

**200** nghĩa là:

- Docker ✅
- Go App ✅
- Firewall / VPS networking ✅

Bước này chỉ để smoke. Production sẽ **đóng** 8787 (mục 18).

---

## 9. Domain

Domain gốc đã có: **`viet.it.com`** (Namecheap). Không cần mua domain mới.

Tạo subdomain API:

```text
api.viet.it.com
```

---

## 10. Cấu hình DNS trên Namecheap

1. Namecheap → **Domain List**
2. `viet.it.com` → **Manage**
3. **Advanced DNS**

Tạo record:

| Field | Value |
|---|---|
| Type | **A Record** |
| Host | `api` |
| Value | `152.42.238.232` |
| TTL | Automatic |

Kết quả:

```text
api.viet.it.com
        ↓
152.42.238.232
```

Không trỏ `www` trừ khi cố ý. Caddy sẽ xin cert cho đúng hostname trong Caddyfile (`api.viet.it.com`).

---

## 11. Kiểm tra DNS

Từ máy local (không phải VPS):

```bash
nslookup api.viet.it.com
```

Kỳ vọng:

```text
Name:    api.viet.it.com
Address: 152.42.238.232
```

Nếu chưa ra IP mới: đợi TTL, thử `nslookup api.viet.it.com 8.8.8.8`. Let's Encrypt **bắt buộc** DNS public đúng trước khi Caddy xin cert.

---

## 12. Tạo Docker network cho reverse proxy

App compose và Caddy phải cùng một Docker network thì Caddy mới resolve được tên container.

```bash
docker network create web
docker network connect web demo-app-backend-1
```

Kiểm tra:

```bash
docker network inspect web
```

Trong `Containers` phải thấy `demo-app-backend-1`.

Nếu recreate container (`docker compose up -d --build` lần sau), **mất** attach tay. Làm lại `docker network connect` hoặc gắn `web` vào `docker-compose.yml` (khuyến nghị — xem mục 20).

---

## 13. Cài Caddy — Caddyfile

```bash
mkdir -p /opt/caddy
nano /opt/caddy/Caddyfile
```

Nội dung:

```caddy
api.viet.it.com {
    reverse_proxy demo-app-backend-1:8787
}
```

Ý nghĩa:

```text
api.viet.it.com
       ↓
Caddy :80 / :443
       ↓
demo-app-backend-1:8787
```

`demo-app-backend-1` là **tên container** trên network `web`, không phải `localhost`. Caddy không gọi `127.0.0.1:8787` của VPS.

---

## 14. Chạy Caddy

```bash
docker run -d \
  --name caddy \
  --restart unless-stopped \
  --network web \
  -p 80:80 \
  -p 443:443 \
  -v /opt/caddy/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data \
  -v caddy_config:/config \
  caddy:2
```

Giải thích volume:

| Mount | Vai trò |
|---|---|
| `Caddyfile` | Cấu hình site + reverse proxy |
| `caddy_data` | Cert Let's Encrypt, account key — **giữ lại** khi recreate Caddy |
| `caddy_config` | Config nội bộ Caddy |

Kiểm tra:

```bash
docker ps
```

Phải có cả hai:

```text
demo-app-backend-1
caddy
```

Port host cần mở (cloud firewall / ufw):

- **80/tcp** — ACME HTTP-01
- **443/tcp** — HTTPS

---

## 15. Kiểm tra Caddy và SSL

```bash
docker logs caddy --tail 100
```

Caddy tự:

```text
Request SSL certificate
        ↓
Let's Encrypt
        ↓
Certificate
        ↓
HTTPS :443
```

Không tự tạo cert, không Certbot, không nginx `ssl_certificate`.

Log thành công thường có `certificate obtained successfully` cho `api.viet.it.com`.

Nếu fail:

- DNS chưa trỏ đúng IP
- Port 80 bị chặn (ACME cần 80)
- Hostname Caddyfile ≠ record DNS
- Rate limit Let's Encrypt (xin cert quá nhiều lần)

Sửa Caddyfile xong, reload:

```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

---

## 16. Test HTTPS

Trình duyệt hoặc curl:

```bash
curl -i https://api.viet.it.com/health
```

Kỳ vọng **200 OK**.

Lúc này:

- Domain ✅
- TLS ✅
- Reverse proxy ✅
- App ✅

HTTP `http://api.viet.it.com` Caddy tự redirect sang HTTPS.

---

## 17. Kiến trúc production

```text
                         Internet
                            │
                            │ 443
                            ▼
                 ┌──────────────────┐
                 │      Caddy       │
                 │    HTTPS/SSL     │
                 └────────┬─────────┘
                          │
                    Docker network `web`
                          │
                          ▼
                 ┌──────────────────┐
                 │      Go API      │
                 │      :8787       │
                 └──────────────────┘
```

| Kiểm tra | URL |
|---|---|
| Public API | `https://api.viet.it.com` |
| Health | `https://api.viet.it.com/health` |

---

## 18. Đóng port 8787 public

Ban đầu map để test IP:

```yaml
ports:
  - "8787:8787"
```

→ `152.42.238.232:8787` lộ Internet. Production **không** để vậy.

Đổi compose thành chỉ expose trong Docker (không publish host):

```yaml
services:
  backend:
    build: .
    restart: unless-stopped
    expose:
      - "8787"
```

Caddy vẫn gọi `demo-app-backend-1:8787` qua network `web`. Client ngoài chỉ còn **443**.

Sau khi sửa:

```bash
docker compose up -d
docker network connect web demo-app-backend-1   # nếu network chưa khai báo trong compose
```

Xác nhận:

```bash
# phải fail / connection refused từ máy local
curl -i http://152.42.238.232:8787/health

# vẫn 200
curl -i https://api.viet.it.com/health
```

Firewall VPS (ví dụ ufw) cũng chỉ cần:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Không `allow 8787`.

---

## 19. Nếu có PostgreSQL / Redis

Không public datastore:

```yaml
postgres:
  expose:
    - "5432"

redis:
  expose:
    - "6379"
```

Không dùng:

```yaml
ports:
  - "5432:5432"
# hoặc
ports:
  - "6379:6379"
```

Go gọi nội bộ bằng **tên service** Docker Compose:

```text
postgres:5432
redis:6379
```

Không dùng `localhost` cho DB từ trong container app.

---

## 20. Gắn network `web` vào Compose (tránh mất connect sau recreate)

Attach tay (`docker network connect`) mất khi recreate container. Khai báo luôn trong compose:

```yaml
services:
  backend:
    build: .
    restart: unless-stopped
    expose:
      - "8787"
    networks:
      - default
      - web

networks:
  web:
    external: true
```

Tạo network một lần:

```bash
docker network create web
```

Caddy vẫn `--network web` như mục 14.

Nên thêm:

- `restart: unless-stopped` (đã có) — tự lên lại khi VPS reboot
- `.env` cho secret (không commit)
- `healthcheck` để Docker restart khi app treo:

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8787/health"]
  interval: 30s
  timeout: 3s
  retries: 3
```

(`wget` / `curl` phải có trong image runtime; Alpine mặc định có `wget`.)

---

## Checklist deploy lần sau

- [ ] 1. Tạo VPS Ubuntu 24.04, lưu IP + password root (hoặc gắn SSH key lúc tạo droplet)
- [ ] 2. `ssh root@<IP>` lần đầu (password hoặc key)
- [ ] 2b. Tạo key Ed25519 local, copy `.pub` vào `/root/.ssh/authorized_keys`
- [ ] 2c. `~/.ssh/config` alias (`Host viet-vps`), login không password
- [ ] 2d. (Tuỳ chọn) Tắt `PasswordAuthentication` sau khi key chắc chắn work
- [ ] 3. `apt update && apt upgrade -y`
- [ ] 4. Cài Docker (`get.docker.com`)
- [ ] 5. Clone source vào `/opt`
- [ ] 6. Dockerfile listen/export `8787`
- [ ] 7. `docker-compose.yml` + `restart: unless-stopped`
- [ ] 8. `docker compose up -d --build`
- [ ] 9. `docker ps` thấy `demo-app-backend-1`
- [ ] 10. `curl http://localhost:8787/health` → 200
- [ ] 11. Test tạm `http://<IP>:8787/health` → 200
- [ ] 12. A record `api` → IP VPS trên Namecheap
- [ ] 13. `nslookup api.viet.it.com` ra đúng IP
- [ ] 14. `docker network create web`
- [ ] 15. App join network `web`
- [ ] 16. `/opt/caddy/Caddyfile` reverse_proxy `demo-app-backend-1:8787`
- [ ] 17. Run Caddy `:80` + `:443`
- [ ] 18. `docker logs caddy` — cert Let's Encrypt OK
- [ ] 19. `curl https://api.viet.it.com/health` → 200
- [ ] 20. Gỡ `ports: "8787:8787"`, chỉ còn public 443

---

## Flow ngắn cần nhớ

```text
VPS
 ↓
SSH (key + config alias)
 ↓
Docker
 ↓
Go App (:8787 trong container)
 ↓
Public IP test (tạm :8787)
 ↓
Domain DNS (A Record api → IP)
 ↓
Caddy (network web, :80 + :443)
 ↓
HTTPS https://api.viet.it.com
 ↓
Đóng :8787 public
 ↓
Public API chỉ qua :443
```

---

## Trạng thái setup hiện tại và bước tiếp

Với VPS `152.42.238.232` + `https://api.viet.it.com/health` **200**: phần **VPS + Docker + DNS + Caddy + HTTPS đã xong**.

Bước nên làm tiếp:

1. Chỉnh `docker-compose.yml`: bỏ `ports: "8787:8787"`, dùng `expose: "8787"` (hoặc chỉ network nội bộ).
2. Gắn `networks: [web]` vào service backend để recreate không mất proxy.
3. Giữ `restart: unless-stopped`, thêm `.env` (không commit secret), thêm `healthcheck`.
4. Confirm từ máy local: `:8787` không còn mở, `https://api.viet.it.com/health` vẫn 200.
