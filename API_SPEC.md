# Berlin Blog — 前後端 API 資料規格文件

> **更新日期**：2026-09-02  
> **後端**：Cloudflare Workers + Hono (`cfserver/`)  
> **前端**：Astro + Axios (`front/`)  
> **基底路徑**：所有 API 路由均以 `/api` 為前綴

---

## 目錄

1. [共用資料型別](#1-共用資料型別)
2. [認證模組 `/api/auth`](#2-認證模組-apiauth)
3. [文章模組 `/api/posts`](#3-文章模組-apiposts)
4. [分類模組 `/api/categories`](#4-分類模組-apicategories)
5. [上傳模組 `/api/upload`](#5-上傳模組-apiupload)
6. [前端 API 客戶端與掛勾](#6-前端-api-客戶端與掛勾)
7. [錯誤回應格式](#7-錯誤回應格式)
8. [認證機制](#8-認證機制)

---

## 1. 共用資料型別

### `Category`（文章分類）

| 欄位         | 型別     | 說明                       |
| ------------ | -------- | -------------------------- |
| `id`         | `number` | 分類 ID（整數，資料庫自增）|
| `name`       | `string` | 分類名稱                   |
| `slug`       | `string` | URL 友善識別碼             |
| `sort_order` | `number` | 排序順序（預設 `99`）      |

---

### `Post`（文章完整物件）

| 欄位             | 型別                       | 必填 | 說明                                    |
| ---------------- | -------------------------- | ---- | --------------------------------------- |
| `id`             | `string`                   | ✅   | UUID（後端 D1 資料庫生成）              |
| `title`          | `string`                   | ✅   | 文章標題                                |
| `author_name`    | `string`                   | ✅   | 作者名稱                                |
| `slug`           | `string`                   | ✅   | URL Slug（支援中文）                    |
| `content`        | `string`                   | ✅   | Editor.js JSON 序列化字串               |
| `summary`        | `string \| null`           | ❌   | 純文字摘要（前 120 字）                 |
| `cover_image`    | `string \| null`           | ❌   | 封面圖片 URL（優先使用 WebP）           |
| `cover_image_id` | `string \| null`           | ❌   | 封面圖片的 R2 Key 或 URL                |
| `status`         | `"draft" \| "published"`   | ✅   | 發布狀態                                |
| `draft_token`    | `string \| null`           | ❌   | 草稿識別 Token（UUID）                  |
| `categories`     | `Category[]`               | ✅   | 關聯分類陣列                            |
| `created_at`     | `string`                   | ✅   | 建立時間（ISO 8601）                    |
| `updated_at`     | `string`                   | ✅   | 最後更新時間（ISO 8601）                |
| `published_at`   | `string \| null`           | ❌   | 發布時間（ISO 8601）                    |

---

### `CoverImageObject`（封面圖片物件）

用於新增/更新文章時，傳遞剛上傳的圖片資訊：

| 欄位           | 型別              | 必填 | 說明                      |
| -------------- | ----------------- | ---- | ------------------------- |
| `original_key` | `string`          | ✅   | R2 Bucket 中原始檔案路徑  |
| `original_url` | `string`          | ✅   | 原始圖片的公開訪問 URL    |
| `webp_key`     | `string \| null`  | ❌   | R2 Bucket 中 WebP 檔案路徑|
| `webp_url`     | `string \| null`  | ❌   | WebP 圖片的公開訪問 URL   |

---

## 2. 認證模組 `/api/auth`

> 同時支援 `/api/login`、`/api/profile` 的短路徑（掛載兩次）

---

### `POST /api/login` — 管理員登入

**權限**：公開（無需 Token）

#### Request Body

| 欄位       | 型別     | 必填 | 說明       |
| ---------- | -------- | ---- | ---------- |
| `email`    | `string` | ✅   | 管理員信箱 |
| `password` | `string` | ✅   | 明文密碼   |

```json
{ "email": "admin@example.com", "password": "yourpassword" }
```

#### Response（成功 `200`）

| 欄位       | 型別      | 說明                          |
| ---------- | --------- | ----------------------------- |
| `success`  | `boolean` | 固定為 `true`                 |
| `token`    | `string`  | JWT Token（效期 7 天，HS256） |
| `nickname` | `string`  | 管理員暱稱                    |

```json
{ "success": true, "token": "eyJ...", "nickname": "子迂" }
```

#### 錯誤回應

| 狀態碼 | 說明                      |
| ------ | ------------------------- |
| `400`  | 缺少帳號或密碼 / 帳密錯誤 |
| `500`  | 伺服器內部錯誤            |

---

### `POST /api/signup` — 建立首位管理員帳號

**權限**：公開（僅限系統尚未有任何管理員時有效）

#### Request Body

| 欄位       | 型別     | 必填 | 說明       |
| ---------- | -------- | ---- | ---------- |
| `email`    | `string` | ✅   | 管理員信箱 |
| `password` | `string` | ✅   | 明文密碼   |
| `nickname` | `string` | ✅   | 管理員暱稱 |

#### Response（成功 `201`）

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "nickname": "子迂",
    "createdAt": "2026-09-02T10:00:00.000Z"
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明                            |
| ------ | ------------------------------- |
| `400`  | 缺少欄位 / 系統已存在管理員帳號 |
| `500`  | 伺服器內部錯誤                  |

---

### `GET /api/profile` — 取得管理員個人資料

**權限**：🔒 需要 JWT Token

#### Response（成功 `200`）

| 欄位        | 型別     | 說明                    |
| ----------- | -------- | ----------------------- |
| `id`        | `number` | 管理員 ID（整數）       |
| `email`     | `string` | 管理員信箱              |
| `nickname`  | `string` | 管理員暱稱              |
| `createdAt` | `string` | 建立時間（ISO 8601）    |

---

### `PUT /api/profile` — 更新管理員暱稱

**權限**：🔒 需要 JWT Token

#### Request Body

| 欄位       | 型別     | 必填 | 驗證規則                  |
| ---------- | -------- | ---- | ------------------------- |
| `nickname` | `string` | ✅   | 不可為空字串，最多 10 個字|

#### Response（成功 `200`）

```json
{ "success": true, "nickname": "新暱稱" }
```

#### 錯誤回應

| 狀態碼 | 說明                          |
| ------ | ----------------------------- |
| `400`  | 暱稱為空 / 暱稱超過 10 字     |
| `401`  | 未提供 Token / Token 已失效   |
| `500`  | 伺服器內部錯誤                |

---

## 3. 文章模組 `/api/posts`

---

### `GET /api/posts` — 取得所有文章列表

**權限**：公開

#### Response（成功 `200`）

回傳 `Post[]` 陣列，依 `created_at` 降冪排序。

---

### `GET /api/posts/:id` — 取得單篇文章

**權限**：公開

#### Path Parameter

| 參數 | 型別     | 說明                                        |
| ---- | -------- | ------------------------------------------- |
| `id` | `string` | 文章 UUID **或** 文章 Slug（中英文皆可）    |

#### Response（成功 `200`）

回傳單篇 `Post` 物件。

#### 錯誤

| 狀態碼 | 說明         |
| ------ | ------------ |
| `400`  | 缺少 ID 參數 |
| `404`  | 文章不存在   |

---

### `POST /api/posts` — 新增文章（含快速建立草稿）

**權限**：🔒 需要 JWT Token

#### Request Body（`CreatePostPayload`）

可傳空物件 `{}` 快速建立草稿，所有欄位均為選填：

| 欄位           | 型別                               | 必填 | 預設值           | 說明                                      |
| -------------- | ---------------------------------- | ---- | ---------------- | ----------------------------------------- |
| `title`        | `string`                           | ❌   | `"未命名文章"`   | 文章標題                                  |
| `author_name`  | `string`                           | ❌   | `"子迂"`         | 作者名稱                                  |
| `slug`         | `string`                           | ❌   | 由標題自動生成   | 自訂 URL Slug                             |
| `content`      | `string`                           | ❌   | `{"blocks":[]}`  | Editor.js JSON 序列化字串                 |
| `summary`      | `string`                           | ❌   | 從 content 提取  | 純文字摘要                                |
| `cover_image`  | `string \| CoverImageObject`       | ❌   | `null`           | 封面圖片 URL 或圖片物件                   |
| `status`       | `"draft" \| "published"`           | ❌   | `"draft"`        | 發布狀態                                  |
| `categories`   | `{ id: number }[]`                 | ❌   | `[]`             | 分類 ID 陣列                              |
| `published_at` | `string`                           | ❌   | 建立時間         | 發布時間（ISO 8601，僅 published 時有效） |

#### Response（成功 `201`）

回傳完整 `Post` 物件（含後端生成的 `id`、`slug`、`draft_token` 等）。

---

### `PUT /api/posts/:id` — 更新文章

**權限**：🔒 需要 JWT Token

#### Path Parameter

| 參數 | 型別     | 說明         |
| ---- | -------- | ------------ |
| `id` | `string` | 文章 UUID    |

#### Request Body（`UpdatePostPayload`）

結構與 `CreatePostPayload` 完全相同，所有欄位均為選填。

> **`cover_image` 傳值說明**：
> - 傳 `string`：直接作為圖片 URL 存入資料庫
> - 傳 `CoverImageObject`：取 `webp_url` 或 `original_url` 作為封面
> - 傳 `null` / 不傳：清空封面圖

#### Response（成功 `200`）

```json
{ "success": true, "post": { /* 完整 Post 物件 */ } }
```

---

### `DELETE /api/posts/:id` — 刪除文章

**權限**：🔒 需要 JWT Token

#### Response（成功 `200`）

```json
{ "success": true, "message": "文章刪除成功" }
```

---

## 4. 分類模組 `/api/categories`

---

### `GET /api/categories` — 取得所有分類

**權限**：公開

#### Response（成功 `200`）

回傳 `Category[]` 陣列，依 `sort_order` 升冪排序。

---

### `POST /api/categories` — 新增分類

**權限**：🔒 需要 JWT Token

#### Request Body

| 欄位   | 型別     | 必填 | 驗證規則     |
| ------ | -------- | ---- | ------------ |
| `name` | `string` | ✅   | 不可為空字串 |

> **Slug 自動生成**：`name` 轉小寫 → 空白換 `-` → 移除非中英數字及連字號字元

#### Response（成功 `201`）

```json
{ "id": 3, "name": "新分類", "slug": "新分類", "sort_order": 99 }
```

#### 錯誤

| 狀態碼 | 說明                   |
| ------ | ---------------------- |
| `400`  | 分類名稱為空           |
| `409`  | 分類名稱或 Slug 已存在 |

---

## 5. 上傳模組 `/api/upload`

---

### `POST /api/upload` — 上傳圖片至 Cloudflare R2

**權限**：🔒 需要 JWT Token  
**Content-Type**：`multipart/form-data`

#### Request Form-Data

| 欄位   | 型別   | 必填 | 說明                             |
| ------ | ------ | ---- | -------------------------------- |
| `file` | `File` | ✅   | 原始圖片檔案（任意圖片格式）     |
| `webp` | `File` | ❌   | 前端最佳化後的 WebP 圖片（選填） |

> **R2 儲存路徑**：原始圖片 `raw/<uuid>.<ext>`，WebP `optimized/<uuid>.webp`

#### Response（成功 `200`）

| 欄位                | 型別              | 說明                             |
| ------------------- | ----------------- | -------------------------------- |
| `success`           | `1`（數字）       | 固定為 `1`（Editor.js 規範）     |
| `file.original_key` | `string`          | R2 中原始圖片的 key 路徑         |
| `file.original_url` | `string`          | 原始圖片公開 URL                 |
| `file.webp_key`     | `string \| null`  | R2 中 WebP 圖片的 key 路徑       |
| `file.webp_url`     | `string \| null`  | WebP 圖片公開 URL                |

```json
{
  "success": 1,
  "file": {
    "original_key": "raw/uuid.jpg",
    "original_url": "https://r2.example.com/raw/uuid.jpg",
    "webp_key": "optimized/uuid.webp",
    "webp_url": "https://r2.example.com/optimized/uuid.webp"
  }
}
```

#### 錯誤（符合 Editor.js 規範）

```json
{ "success": 0, "message": "錯誤說明" }
```

---

## 6. 前端 API 客戶端與掛勾

### Axios 實例設定（`front/src/utils/api.ts`）

| 設定項          | 值                                                                       |
| --------------- | ------------------------------------------------------------------------ |
| `baseURL`       | `import.meta.env.PUBLIC_API_URL` 或 `/api`                               |
| 預設 Header     | `Content-Type: application/json`                                         |
| 請求攔截器      | 從 `localStorage.getItem("adminToken")` 讀取，加入 `Authorization: Bearer <token>` |
| 回應 401 處理   | 清除 localStorage Token，強制跳轉至 `/admin/login`                       |

---

### `postAPI` 方法對應表（`front/src/utils/postAPI.ts`）

| 方法                                    | HTTP               | 說明                              |
| --------------------------------------- | ------------------ | --------------------------------- |
| `postAPI.getPosts()`                    | `GET /posts`       | 取得所有文章                      |
| `postAPI.getPostById(id: string)`       | `GET /posts/:id`   | 依 UUID 取得單篇文章              |
| `postAPI.createPost(payload?)`          | `POST /posts`      | 新增文章（可傳空 `{}` 建立草稿）  |
| `postAPI.updatePost(id, payload)`       | `PUT /posts/:id`   | 更新文章                          |
| `postAPI.deletePost(id: string)`        | `DELETE /posts/:id`| 刪除文章                          |
| `postAPI.getCategories()`               | `GET /categories`  | 取得所有分類                      |
| `postAPI.createCategory(name: string)`  | `POST /categories` | 新增分類                          |
| `postAPI.uploadImage(file, webpFile?)`  | `POST /upload`     | 上傳圖片至 R2                     |

---

### `EditModal` 掛勾流程與表單欄位規格

#### `openModal(id: string | null)` — 開啟彈窗

| 情境                         | 呼叫 API                         | 資料型別          |
| ---------------------------- | -------------------------------- | ----------------- |
| **新增模式**（`id = null`）  | `postAPI.createPost({})`         | 回傳 `Post` 物件  |
| **編輯模式**（`id = UUID`）  | `postAPI.getPostById(id)`        | 回傳 `Post` 物件  |

新增模式預設 Payload：

| 欄位          | 型別     | 值                                      |
| ------------- | -------- | --------------------------------------- |
| `title`       | `string` | `"未命名文章"`                          |
| `author_name` | `string` | 從 `localStorage.getItem("nickname")` 讀取 |
| `status`      | `string` | `"draft"`                               |

---

#### `handleSubmit(e: Event)` — 表單送出

`formHelpers.buildPayload()` 收集的欄位：

| 表單元素                    | 欄位名稱       | 型別                         | 說明                                           |
| --------------------------- | -------------- | ---------------------------- | ---------------------------------------------- |
| `els.titleInput.value`      | `title`        | `string`                     | 文章標題                                       |
| `els.slugInput.value`       | `slug`         | `string \| undefined`        | 空字串則不傳，由後端從標題自動生成             |
| `els.authorInput.value`     | `author_name`  | `string`                     | 作者名稱                                       |
| Editor.js `saveEditorContent()` | `content`  | `string`                     | `JSON.stringify(editorData)`                   |
| `els.summaryInput.value`    | `summary`      | `string`                     | 純文字摘要                                     |
| `els.statusSelect.value`    | `status`       | `"draft" \| "published"`     | 發布狀態                                       |
| `els.categoriesContainer` checked items | `categories` | `Category[]`  | 已勾選的分類物件陣列                           |
| `els.coverInput.files[0]`   | `cover_image`  | `string \| CoverImageObject` | 有新圖：先 upload 再傳物件；否則傳既有 URL     |
| `els.publishedAtInput.value`| `published_at` | `string \| undefined`        | `datetime-local` 格式，空字串時不傳            |

完整送出後呼叫：`postAPI.updatePost(currentPostId, payload)`

---

### `AuthManager`（`front/src/utils/auth.ts`）

| 方法                                | 說明                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| `authManager.checkAuth()`           | 若 localStorage 無 `adminToken`，跳轉 `/login`         |
| `authManager.getNickname()`         | 從 `localStorage.getItem("nickname")` 讀取暱稱         |
| `authManager.setNickname(nickname)` | 寫入 `localStorage.setItem("nickname", nickname)`      |
| `authManager.logout()`              | 清除 `adminToken`、`adminNickname`，跳轉 `/login`      |

**LocalStorage 鍵名彙整**：

| 鍵名            | 型別     | 說明                                    |
| --------------- | -------- | --------------------------------------- |
| `adminToken`    | `string` | JWT Token（登入後儲存，由 api.ts 讀取） |
| `nickname`      | `string` | 管理員暱稱顯示用                        |
| `adminNickname` | `string` | 備用暱稱鍵（logout 時一併清除）         |
| `editor_draft`  | `string` | Editor.js 暫存草稿（儲存成功後清除）    |

---

## 7. 錯誤回應格式

一般 API 錯誤：

```json
{ "error": "錯誤說明訊息" }
```

上傳模組（符合 Editor.js 規範）：

```json
{ "success": 0, "message": "錯誤說明訊息" }
```

---

## 8. 認證機制

### JWT Token Payload 結構

| 欄位    | 型別     | 說明                              |
| ------- | -------- | --------------------------------- |
| `sub`   | `string` | 管理員 ID（字串化整數）           |
| `email` | `string` | 管理員信箱                        |
| `exp`   | `number` | 過期時間（Unix 時間戳，效期 7 天）|
| `iat`   | `number` | 簽發時間（Unix 時間戳）           |

### 受保護端點請求 Header

```http
Authorization: Bearer <JWT Token>
```

前端 Axios 實例自動從 `localStorage.getItem("adminToken")` 讀取並附加。

---

## 附錄：Slug 生成規則

前後端使用相同邏輯：

1. 轉小寫
2. 去除頭尾空白
3. 移除非 `[\w\s\-\u4e00-\u9fa5]` 字元（保留中文、英數字、連字號）
4. 空白或底線替換為 `-`
5. 多個連字號合併為一個
6. 去除頭尾連字號
7. 若結果為空，預設為 `"post"`
8. **後端額外**：自動檢查 DB 是否重複，若重複則加後綴（`-2`、`-3`...）
