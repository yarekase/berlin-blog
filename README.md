# 子迂的蠹酸齋 — 專案架構文件

> 最後更新：2026-09

---

## 專案總覽

**berlin-blog** 是一個個人部落格系統，採前後端分離架構，全部部署於 Cloudflare 生態系。

| 項目     | 說明                                                        |
| -------- | ----------------------------------------------------------- |
| 前端     | Astro + Tailwind CSS，部署於 Cloudflare Pages               |
| 後端     | Hono + Cloudflare Workers（Worker 名稱：`berlin-blog-api`） |
| 資料庫   | Cloudflare D1（SQLite），ORM 使用 Drizzle                   |
| 圖片儲存 | Cloudflare R2（Bucket：`berlin-blog`）                      |
| 認證     | JWT（儲存於瀏覽器 Cookie）                                  |

```
berlin-blog/
├── front/          # 前端（Astro）
├── cfserver/       # 後端（Hono on Cloudflare Workers）
└── ARCHITECTURE.md
```

## 網站作業流程

### 公開閱讀流程

1. 使用者進入 `/` 首頁。
2. 前端在 SSR 階段呼叫 `GET /api/posts` 與 `GET /api/categories`。
3. 首頁只顯示 `status = "published"` 的文章，第一篇作為特色文章，接著顯示近期文章。
4. 使用者可從分類列進入分類頁、從「所有文章」進入 `/posts`，或點擊文章進入 `/post/:slug`。
5. `/posts` 依建立時間倒序顯示文章，每頁最多 10 篇，透過 `?page=N` 切換頁面。
6. `/post/:slug` 呼叫 `GET /api/posts/:id` 取得完整內容，並將 Editor.js JSON 轉為閱讀頁內容。

### 搜尋流程

1. 使用者在首頁輸入非空白關鍵字並按下「搜尋」。
2. 瀏覽器導向 `/search?q=關鍵字`，不在首頁即時顯示結果。
3. 搜尋頁在 SSR 階段取得已發布文章，對標題、分類名稱 / slug 與文章內文進行不分大小寫比對。
4. 有結果時顯示符合文章；沒有結果時顯示「找不到相關的文章」。
5. 搜尋結果下方固定顯示最新三篇文章，作為替代閱讀入口。

### 管理員登入與後台流程

1. 使用者從首頁「登入」進入 `/admin/login`。
2. 登入頁呼叫 `POST /api/login`，成功後將 token 寫入 `adminToken` Cookie。
3. 進入 `/admin/dashboard` 時，`admin/middleware.ts` 先檢查 `adminToken` Cookie；沒有 token 就導回登入頁。
4. 儀表板 SSR 呼叫 `GET /api/posts`，把文章資料傳給統計區、重點文章選擇器與文章管理表格。
5. 使用者可在文章管理區新增、編輯、發布、保存草稿或刪除文章。
6. 首頁偵測到 `adminToken` Cookie 時顯示「登出」；登出會清除 Cookie 與瀏覽器端 token 資料。

### 新增或編輯文章流程

1. 點擊「新增文章」後，前端先呼叫 `POST /api/posts` 建立草稿並取得文章 UUID。
2. 編輯器載入分類、標題、slug、作者、摘要、發布狀態與內容欄位。
3. 若有封面圖片，先呼叫 `POST /api/upload` 上傳至 R2。
4. Editor.js 將內容保存為 JSON 字串，前端組合完整 payload。
5. 前端呼叫 `PUT /api/posts/:id` 保存文章；若狀態為 `published`，公開頁面下次請求即可看見文章。
6. 編輯既有文章時，先呼叫 `GET /api/posts/:id` 載入資料，保存時仍使用 `PUT /api/posts/:id`。

### 重點文章流程

1. 後台儀表板在統計區與文章管理區之間顯示重點文章選擇器。
2. 下拉選單列出目前 `GET /api/posts` 回傳的所有文章標題。
3. 使用者選取文章並按下「確認」後，前端預備呼叫 `POST /api/posts/featured`，傳送 `{ "post_id": "文章 UUID" }`。
4. 目前前端介面已完成，後端端點與資料表儲存邏輯尚待實作；完成後首頁特色文章需改由該設定值決定。

---

## 後端（cfserver）

### 技術棧

- **Runtime**：Cloudflare Workers
- **框架**：[Hono](https://hono.dev/) v4
- **ORM**：[Drizzle ORM](https://orm.drizzle.team/) + Cloudflare D1
- **語言**：TypeScript

### 目錄結構

```
cfserver/
├── src/
│   ├── index.ts              # 主入口，掛載所有路由
│   ├── db/
│   │   ├── schema.ts         # Drizzle 資料表定義
│   │   └── index.ts          # getDb() 工廠函式
│   ├── middlewares/
│   │   └── auth.middleware.ts # requireAuth JWT 驗證中間件
│   ├── modules/              # 功能模組（路由 / 控制器 / 服務 三層架構）
│   │   ├── auth/
│   │   │   ├── auth.route.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.service.ts
│   │   ├── posts/
│   │   │   ├── post.route.ts
│   │   │   ├── post.controller.ts
│   │   │   └── post.service.ts
│   │   ├── categories/
│   │   │   ├── category.route.ts
│   │   │   ├── category.controller.ts
│   │   │   └── category.service.ts
│   │   └── upload/
│   │       ├── upload.route.ts
│   │       ├── upload.controller.ts
│   │       └── upload.service.ts
│   ├── types/
│   │   └── env.ts            # AppContext / Env 型別定義
│   └── utils/
│       ├── appError.ts       # 自訂錯誤類別 AppError
│       ├── auth.ts           # AuthManager（JWT 工具）
│       └── postManager.ts    # 文章相關業務邏輯工具
├── migrations/               # Drizzle 資料庫遷移 SQL
├── drizzle.config.ts
└── wrangler.toml             # Cloudflare Workers 部署設定
```

### 模組三層架構

每個功能模組統一採用 `Route → Controller → Service` 三層分工：

| 層             | 職責                                        |
| -------------- | ------------------------------------------- |
| **Route**      | 定義 HTTP 方法與路徑，套用中間件            |
| **Controller** | 驗證請求參數，呼叫 Service，回傳 HTTP 回應  |
| **Service**    | 處理核心業務邏輯，直接操作資料庫（Drizzle） |

### API 端點總覽

所有路由前綴為 `/api`

#### 認證模組（Auth）

| 方法 | 路徑           | 說明                   | 認證    |
| ---- | -------------- | ---------------------- | ------- |
| POST | `/api/login`   | 管理員登入，回傳 JWT   | ❌ 公開 |
| GET  | `/api/profile` | 取得目前登入管理員資訊 | ✅ 需要 |
| PUT  | `/api/profile` | 更新管理員暱稱         | ✅ 需要 |
| POST | `/api/signup`  | 建立首位管理員帳號     | ❌ 公開 |

#### 文章模組（Posts）

| 方法   | 路徑             | 說明                              | 認證    |
| ------ | ---------------- | --------------------------------- | ------- |
| GET    | `/api/posts`     | 取得所有文章列表                  | ❌ 公開 |
| GET    | `/api/posts/:id` | 取得單篇文章（支援 UUID 與 Slug） | ❌ 公開 |
| POST   | `/api/posts`     | 建立新文章 / 草稿                 | ✅ 需要 |
| PUT    | `/api/posts/:id` | 更新文章                          | ✅ 需要 |
| DELETE | `/api/posts/:id` | 刪除文章                          | ✅ 需要 |

#### 分類模組（Categories）

| 方法 | 路徑              | 說明         | 認證    |
| ---- | ----------------- | ------------ | ------- |
| GET  | `/api/categories` | 取得所有分類 | ❌ 公開 |
| POST | `/api/categories` | 建立新分類   | ✅ 需要 |

#### 上傳模組（Upload）

| 方法 | 路徑          | 說明          | 認證    |
| ---- | ------------- | ------------- | ------- |
| POST | `/api/upload` | 上傳圖片至 R2 | ✅ 需要 |

#### 健康檢查

| 方法 | 路徑          | 說明                 |
| ---- | ------------- | -------------------- |
| GET  | `/api/health` | 確認 Worker 運作正常 |

### 資料庫 Schema

```
admins          管理員帳號（email, password_hash, nickname）
posts           文章（UUID PK, title, slug, content[EditorJS JSON], status, coverImageId）
categories      分類（id, name, slug, sortOrder）
post_categories 文章↔分類 多對多關聯表
images          圖片（UUID PK, postId FK, originalKey, webpKey, sortOrder）
```

> `posts.coverImageId` 沒有做成 Foreign Key，刪除封面圖時需在 API 層額外處理。

### Bindings（Wrangler）

| Binding                          | 類型        | 用途           |
| -------------------------------- | ----------- | -------------- |
| `DB`                             | D1 Database | 主要資料庫     |
| `MY_BUCKET`                      | R2 Bucket   | 圖片儲存       |
| `JWT_SECRET`                     | 環境變數    | JWT 簽名金鑰   |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 環境變數    | 預設管理員帳號 |

### 錯誤處理慣例

- 所有 Service 層拋出 `AppError(statusCode, message)` 表示可預期的業務錯誤
- Controller 的 catch 區塊判斷 `instanceof AppError`，回傳對應 HTTP 狀態碼
- 非預期的系統錯誤統一回傳 `500`，並在伺服器端 `console.error` 記錄

---

## 前端（front）

### 技術棧

- **框架**：[Astro](https://astro.build/) v7（SSR 模式）
- **CSS**：Tailwind CSS v4
- **編輯器**：Editor.js（文章內容編輯）
- **Adapter**：`@astrojs/cloudflare`，部署於 Cloudflare Pages
- **HTTP 客戶端**：原生 `fetch` + axios

### 目錄結構

```
front/
├── src/
│   ├── pages/
│   │   ├── index.astro           # 部落格首頁（公開）
│   │   ├── posts.astro           # 所有文章頁（公開，支援分頁）
│   │   ├── search.astro          # 搜尋結果頁（公開）
│   │   ├── post/[id].astro       # 文章閱讀頁（公開）
│   │   └── admin/
│   │       ├── login.astro       # 管理員登入頁
│   │       ├── dashboard.astro   # 後台管理儀表板
│   │       ├── [id].astro        # 文章編輯頁（動態路由）
│   │       └── middleware.ts     # 後台路由守衛（未登入自動導回 login）
│   ├── components/
│   │   ├── Navigation.astro      # 後台導航欄
│   │   ├── Statistics.astro      # 儀表板統計數據
│   │   ├── FeaturedPostSelector.astro # 重點文章選擇器
│   │   ├── PostsList.astro       # 文章列表元件
│   │   ├── SettingsModal.astro   # 帳號設定 Modal
│   │   └── EditModal/            # 文章編輯 Modal（模組化）
│   ├── layouts/
│   │   └── Layout.astro          # 共用頁面 Layout
│   ├── scripts/
│   │   └── adminDashboard.ts     # 後台儀表板客戶端邏輯
│   ├── styles/
│   │   └── editor.css            # Editor.js 客製化樣式
│   ├── utils/
│   │   └── postManager.ts        # 前端文章資料管理工具（型別 + 工具函式）
│   └── types/                    # 前端型別定義
├── public/                       # 靜態資源
├── astro.config.mjs
└── tailwind.config.mjs
```

### 頁面結構

#### 公開頁面

| 路徑            | 說明                               |
| --------------- | ---------------------------------- |
| `/`             | 首頁，顯示最新已發布文章與分類篩選 |
| `/posts`        | 所有文章頁，每頁顯示 10 篇         |
| `/search?q=...` | 搜尋結果頁，搜尋標題、分類與內文   |
| `/post/:slug`   | 公開文章閱讀頁                     |

#### 後台管理（需登入）

| 路徑               | 說明                             |
| ------------------ | -------------------------------- |
| `/admin/login`     | 登入頁，驗證後將 JWT 寫入 Cookie |
| `/admin/dashboard` | 管理儀表板，文章總覽、狀態統計   |
| `/admin/[id]`      | 文章編輯頁，使用 Editor.js       |

> 後台路由保護透過 `admin/middleware.ts` 實作，偵測 `adminToken` Cookie，不存在則 redirect 至 login。

### 資料流

- 首頁、搜尋頁、所有文章頁與文章閱讀頁在 **SSR 階段**（`.astro` frontmatter）呼叫後端 API 拉取資料
- 後台管理的互動操作（新增 / 更新 / 刪除文章、上傳圖片）透過 **客戶端 JavaScript** 呼叫後端 API
- JWT Token 的登入狀態以 **Cookie（`adminToken`）** 為準；後台 API 請求時從 Cookie 取出 token，附在 `Authorization: Bearer` Header
- 首頁的登入 / 登出顯示由 SSR 讀取 `adminToken` Cookie 決定

---

## 未來規劃（待確認）

> ⚠️ 以下為根據現有架構推測的可能擴展方向，請確認後再納入正式文件。

### 後端

- [ ] **`/api/signup` 保護機制**：目前為公開端點，可考慮在首次建立帳號後關閉，或改為 invite token 機制
- [ ] **圖片刪除 API**：刪除 R2 圖片時同步清除 D1 `images` 表紀錄，以及 `posts.coverImageId` 的處理
- [ ] **草稿預覽**：利用 `draftToken` 欄位實作不公開的草稿預覽連結
- [ ] **文章搜尋 / 全文索引**：目前尚無搜尋端點
- [ ] **分類刪除 / 修改** API
- [ ] **分頁（Pagination）**：文章列表目前一次回傳所有資料

### 前端

- [x] **文章詳細頁**：`/post/:slug` 已支援文章內文閱讀
- [x] **Editor.js 內容渲染器**：文章閱讀頁已支援常用 Editor.js block
- [ ] **重點文章後端儲存**：實作 `POST /api/posts/featured` 與首頁特色文章查詢
- [ ] **分類篩選**：首頁有分類 UI，可強化篩選功能
- [ ] **SEO 優化**：Open Graph、Twitter Card 等 meta 標籤
- [ ] **圖片優化**：整合 R2 的 WebP 版本，加入 `<picture>` 元素
