# Các bước custom một SotaAgents app (Inkline)

App Sota **không phải website riêng**. Bạn custom **capability** (tool, skill, UI card) rồi Core gắn vào chat. Native UI chạy trong host; backend chỉ HTTP + JWT.

Login → deploy: [sota-login-to-deploy.md](./sota-login-to-deploy.md).  
VPS/HTTPS: [deploy-go-app-domain-https.md](./deploy-go-app-domain-https.md).

Trước khi thêm field lạ: `sota manifest schema` hoặc `sota manifest explain contributes.tools`. Đừng tự bịa key manifest.

---

## 0. Quyết định custom cái gì


| Mục tiêu                    | Làm gì                                                       | Không làm                                       |
| --------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Đổi tên hiện thị            | `displayName` / `description` trong `manifest.yaml`          | Đổi `appId` nếu đã deploy (JWT `aud` + catalog) |
| Agent biết khi nào gọi tool | Skill `src/skills/<name>/SKILL.md` + `description` trên tool | Slash command — skill là system prompt          |
| Agent thực thi việc         | Tool: schema + route + handler                               | Gọi private Core API từ UI                      |
| Card dưới tin nhắn chat     | Native `tool-view` trong `src/ui/app.tsx`                    | Deploy frontend lên `api.viet.it.com`           |
| Tab Admin workspace         | `surface: page` + `useAppFetch`                              | Hardcode URL backend                            |
| Tính toán / file / DB       | Backend `src/backend/`                                       | Tin `oid`/`wid` từ body request                 |


Core lo: org, workspace, install, JWT, chọn Staging/Production, chat shell.

---



## 1. Identity (một lần)

`appId` phải **unique trên production**. Scaffold `my-app` là app canonical — bạn không deploy được.

Hiện tại:

- `appId`: `inkline` (JWT audience, `data-sota-app`, CSS scope)
- `displayName`: Inkline (`@ Inkline` trong chat)

Đổi `appId` phải sửa đồng bộ: `manifest.yaml`, `src/backend/server.ts`, `data-sota-app`, CSS, `sectionId`/`route` Admin, rebuild UI, **rebuild Docker trên VPS**.

---



## 2. Vòng lặp local (trước khi deploy)

Terminal 1 — backend + UI watch:

```bash
npm run dev
```

Terminal 2 — Development session trên Core:

```bash
sota config set-origin https://app.sotaagents.ai
sota whoami
npm run dev:sota
```

Development biến mất khi `sota dev stop`. Test tool trên chat Development, không cần `sota deploy` mỗi lần sửa handler.

Nếu `sota contracts ensure` lỗi `EPERM` (Cursor lock `.sota`):

```bash
npx vite build --watch --config vite.config.ts
```

---



## 3. Thêm capability mới — thứ tự file

Ví dụ tool `do-thing`. Copy pattern `count-words`.

### 3.1 JSON Schema

- `src/schemas/do-thing-input.schema.json`
- `src/schemas/do-thing-output.schema.json`

Bắt buộc: `type: object`, `required`, `additionalProperties: false`, mô tả từng field. Backend validate lại cùng bound.

### 3.2 Handler

`src/backend/tool.do-thing.ts` — parse input, làm việc, trả JSON khớp output schema.

Đăng ký trong `src/backend/tool-routes.ts`:

```ts
app.post(
  '/tools/do-thing',
  requireSotaInvocation(appId, 'tool:do-thing'),
  async (request, response) => {
    await respondWithTool(request, response, (input) => handleDoThing(input));
  },
);
```

Scope JWT = `tool:<tên-tool>`. Tenant chỉ lấy từ `response.locals.sota` (`iid`/`oid`/`wid`/`sub`/`scp`).

### 3.3 Manifest

Trong `contributes.tools`:

```yaml
- name: do-thing
  description: When to call, what the backend does, what it returns, limits.
  route: POST /tools/do-thing
  inputSchema: src/schemas/do-thing-input.schema.json
  outputSchema: src/schemas/do-thing-output.schema.json
  timeoutMs: 15000
  failure_mode: abort
```

`description` phải nói **khi nào gọi** và **trả gì**. Tên tool ổn định sau khi đã có conversation.

Hoặc scaffold: `sota add backend tool` rồi sửa file generated.

### 3.4 Skill (để model gọi đúng)

`src/skills/do-thing/SKILL.md` — khi nào gọi, input bắt buộc, không làm gì.

Manifest:

```yaml
- name: do-thing
  description: When to call do-thing.
  appendsTo: system
  content: src/skills/do-thing
  timeoutMs: 3000
  failure_mode: skip
```

Skill **không** hiện slash command. Agent đọc skill rồi gọi tool.

### 3.5 Card UI (tuỳ chọn)

1. Component `DoThingResult` trong `src/ui/app.tsx`.
2. Export trong `surfaces`.
3. CSS scope `[data-sota-app="inkline"]` trong `src/ui/styles.css`.
4. Locale `src/locales/en.json`.
5. Manifest `contributes.ui`:

```yaml
- id: do-thing-result
  kind: nativeModule
  surface: tool-view
  slot: chat.message.inline.below
  label: Do thing
  toolNames: [do-thing]
  renderBeforeOutput: true
  module:
    entry: dist/ui/app.js
    export: DoThingResult
    styles: dist/ui/app.css
```

`export` phải đúng key trong `surfaces`. UI gọi backend bằng `useAppFetch('/api/...')` — **không** hardcode `https://api.viet.it.com`.

### 3.6 `.sotabundle`

Nếu CLI/bundle liệt kê skill path, thêm `src/skills/do-thing` cho khớp các skill hiện có.

---



## 4. Custom UI Admin

`AdminScreen` + `route: /inkline/*` + `slot: admin.workspace.tab`.  
Gọi backend: `useAppFetch`. Route đó cũng `requireSotaInvocation` với scope `app:http` (xem `/api/hello`).

---



## 5. Đổi copy / i18n

- Tên app: `manifest.yaml` `displayName`
- Label tool card: `contributes.ui[].label` + `src/locales/en.json`
- Hướng dẫn agent: `src/skills/*/SKILL.md` và `description` của tool

---



## 6. Kiểm tra rồi đẩy lên Core

```bash
npm run build          # hoặc vite build nếu EPERM
sota validate          # phải: Manifest preflight passed (server-side)
sota deploy --description "Add do-thing tool"
```

- **Chỉ skill / schema / UI / manifest** → `sota deploy` (artifact mới). Chat Staging.
- **Chỉ handler backend** → rebuild Docker VPS. JWT vẫn `aud: inkline`.
- **Cả hai** → deploy **và** `docker compose up -d --build` trên VPS.

Health: `https://api.viet.it.com/health` → `"appId":"inkline"`.

Promote Production: `sota release` sau khi Staging ổn. Chi tiết: [sota-login-to-deploy.md](./sota-login-to-deploy.md).

---



## 7. Việc không custom trong app

- Mint JWT / giữ private key Sota
- Tin `x-org-id` từ client; chỉ claim đã verify
- Copy cookie session browser vào backend để tải file Core
- `localhost` trong `service.baseUrl` (chỉ `environments.local`)
- Sửa file dưới `dist/` hay `.sota/` bằng tay (trừ lockfile origin khi đổi stg ↔ pro)

---



## 8. Checklist một thay đổi

1. Schema input/output
2. Handler + `requireSotaInvocation(appId, 'tool:…')`
3. `manifest.yaml` tool (+ skill, + ui nếu có)
4. `surfaces` export khớp `module.export`
5. CSS `[data-sota-app="inkline"]`
6. `sota validate`
7. Local: `sota dev` **hoặc** `sota deploy` + rebuild VPS
8. Chat `@ Inkline`, gọi đúng workflow, xem card + log 401 `aud` nếu image cũ

