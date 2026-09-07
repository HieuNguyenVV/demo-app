# Sota CLI: từ login đến deploy (Inkline)

Runbook cho app **Inkline** (`appId: inkline`) trên **Sota production**. Backend hosted: `https://api.viet.it.com`.

VPS, Docker, DNS, Caddy: xem [deploy-go-app-domain-https.md](./deploy-go-app-domain-https.md).  
Thêm tool / skill / UI: xem [sota-customize-app.md](./sota-customize-app.md).

## 1. Phân biệt môi trường

| | Production (đang dùng) | Staging cũ (stg) |
|---|---|---|
| Platform (web) | `https://app.sotaagents.ai` | `https://v4.stg.sotaagents.ai` |
| API / JWKS | `https://api.v4.sotaagents.ai` | `https://api.v4.stg.sotaagents.ai` |
| Chat | `@ Inkline` trên app.sotaagents.ai | workspace stg, app khác |

CLI login, `sota deploy`, và JWT `aud` **không dùng chung** giữa hai origin. Đừng mix.

`sota deploy` = **Staging app trên Core đang chọn** (không phải VPS).  
`sota release` = promote artifact Staging đó lên **Production** trên cùng Core.  
`sota dev` = Development local + tunnel, không thay thế deploy.

## 2. Trỏ CLI sang production

Trong thư mục project:

```bash
sota config set-origin https://app.sotaagents.ai
sota config show
```

`sota config show` phải ra API `https://api.v4.sotaagents.ai`.

Mở `.sota/lockfile.json` và khớp origin với platform:

```json
{
  "appId": "inkline",
  "appSlug": "inkline",
  "origin": "https://app.sotaagents.ai"
}
```

Nếu `origin` vẫn là `https://v4.stg.sotaagents.ai`, `sota whoami` sẽ hiện `Auth: none` dù vừa login production. Sửa `origin` rồi chạy lại `sota whoami`.

`.sota/` không commit. File này chỉ trên máy local.

## 3. Login

```bash
sota login
```

Nếu browser không bắt được callback (Windows / remote):

```bash
sota login --manual
```

Mở URL `https://app.sotaagents.ai/cli-auth?...`, authorize, dán one-time token vào CLI. **Không paste token vào chat / ticket.**

Kiểm tra:

```bash
sota whoami
```

Kỳ vọng:

```text
- Auth: dev-oauth <email>, expires ...
- Origin: https://app.sotaagents.ai
- App: inkline
```

Nếu `Auth: none` + Origin stg → quay lại bước 2 (lockfile).  
Nếu `401 AUTH_SESSION_INVALID` / `No user context` trên `api.v4.stg...` → CLI chưa trỏ production.

## 4. Trước khi deploy: identity + backend

- `manifest.yaml`: `appId: inkline` (không dùng `my-app` — id đó là app canonical trên production, deploy sẽ bị chặn Owner/Contributor).
- `src/backend/server.ts`: `const appId = 'inkline'` (JWT `aud` phải khớp).
- `docker-compose.yml` trên VPS:

```yaml
SOTA_CORE_ORIGIN: https://api.v4.sotaagents.ai
SOTA_WEB_ORIGIN: https://app.sotaagents.ai
```

`service.baseUrl` / `health.url` trong manifest: `https://api.viet.it.com` (localhost chỉ nằm trong `environments.local`).

## 5. Build

```bash
npm run build
sota validate
```

`sota validate` phải: `Manifest preflight passed (server-side)`.

Nếu `sota contracts ensure` fail `EPERM` khi rename `.sota/app-ui-contracts/current` (Cursor đang lock folder):

```bash
npm run build:backend
npx vite build --config vite.config.ts
sota validate
```

Validate đọc `dist/ui/app.js` + `dist/ui/app.css`. CSS phải scope `[data-sota-app="inkline"]`. Đổi `appId` mà không rebuild UI → `NATIVE_GRAPH_INVALID`.

## 6. Deploy Staging trên Core production

```bash
sota deploy --description "Short note of what changed"
```

Thành công: Staging version mới, có artifact id. App card **Staging** trên `https://app.sotaagents.ai`.

Lỗi thường gặp:

| Thông báo | Cách xử lý |
|---|---|
| `Only the App Owner or a Contributor can deploy this canonical app` | Đổi `appId` khỏi `my-app` (đã dùng `inkline`) |
| `401 AUTH_SESSION_INVALID` trên `api.v4.stg...` | Login + origin/lockfile production |
| Validate fallback “Could not reach … stg” | Giống trên; lint local không đủ để deploy |

## 7. Rebuild backend trên VPS

`sota deploy` **không** cập nhật container. Core sẽ gửi JWT `aud: inkline` và ký bằng JWKS production. Process cũ (`aud: my-app` hoặc origin stg) trả 401.

Trên VPS:

```bash
cd /path/to/demo-app
git pull
docker compose up -d --build
docker network connect web demo-app-backend-1
docker restart caddy
```

Nếu `network connect` báo already connected thì bỏ qua.

Health:

```bash
curl -sS https://api.viet.it.com/health
```

Phải có `"appId":"inkline"`. Log token reject `unexpected "aud" claim` với `expected.audience: my-app` nghĩa là image cũ.

## 8. Cài app và test trên chat

1. Console: [https://app.sotaagents.ai/console/apps](https://app.sotaagents.ai/console/apps) — Inkline, môi trường Staging.
2. Install vào org/workspace đang chat.
3. Trong chat: **@ Inkline**, gọi tool (ví dụ generate-drawio).
4. Card tool hiện **dưới** tin nhắn sau khi tool thành công.

Chưa `sota release` thì Production Core trống; test trên Staging.

## 9. (Tuỳ chọn) Promote Production

Chỉ sau khi Staging đã smoke ổn:

```bash
sota release
```

Promote **đúng** artifact Staging vừa test. Deploy Staging mới không tự đẩy Production.

## 10. Checklist nhanh

```bash
sota config set-origin https://app.sotaagents.ai
sota login --manual          # nếu login thường fail
sota whoami                  # Auth + Origin production, App inkline
npm run build                # hoặc vite build nếu EPERM
sota validate
sota deploy --description "..."
# VPS: git pull && docker compose up -d --build
curl -sS https://api.viet.it.com/health
```

Chat: `https://app.sotaagents.ai` → **@ Inkline**.
