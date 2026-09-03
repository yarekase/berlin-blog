# 後台文章管理 — 資料流說明文件

> 最後更新：2026-09-04

---

## 一、認證機制

本專案採用 **Cookie-based JWT 認證**，伺服器端與客戶端分別如下：

| 層級 | 機制 | 說明 |
|------|------|------|
| SSR（伺服器端） | `Astro.cookies.get("adminToken")` | `dashboard.astro` 在渲染前驗證 cookie，未登入直接 redirect |
| 客戶端 API | `document.cookie` 解析 `adminToken` | `api.ts` 的 axios 請求攔截器讀取 cookie，附加至 `Authorization: Bearer <token>` header |

> ⚠️ **注意**：`localStorage.getItem("adminToken")` 在此專案**不應使用**，token 存於 cookie，不是 localStorage。

---

## 二、儀表板頁面資料流（文章列表）

```
[瀏覽器請求 /admin/dashboard]
        ↓
dashboard.astro（SSR）
  1. 驗證 cookie adminToken，失敗則 redirect /admin/login
  2. fetch(`${API_URL}/api/posts`, { headers: { Authorization: `Bearer ${token}` } })
  3. posts: Post[] 傳給子元件
        ↓
PostsList.astro
  - 接收 props: { posts: Post[] }
  - 伺服器端渲染文章表格 HTML
        ↓
瀏覽器顯示文章列表
```

---

## 三、新增文章流程（POST → PUT）

```
[使用者點擊「新增文章」按鈕]
        ↓
adminDashboard.ts (newPostBtn click)
  - dispatch CustomEvent("open-edit-modal", { detail: { id: null } })
        ↓
EditModal.astro (監聽 open-edit-modal)
  - 呼叫 handler.openModal(null)
        ↓
modalLogic.ts → openModal(null)
  1. categoryService.loadCategories()     ← GET /api/categories
  2. postAPI.createPost({ title, author_name, status: "draft" })  ← POST /api/posts
     - 取得後端生成的 UUID → currentPostId = draftPost.id
  3. 填充表單預設值（標題：「未命名文章 YYYY-MM-DD」）
  4. 開啟 Modal
        ↓
[使用者編輯內容後點擊「保存」]
        ↓
modalLogic.ts → handleSubmit()
  1. （若有封面圖）postAPI.uploadImage()  ← POST /api/upload
  2. saveEditorContent()                  ← 取得 Editor.js JSON
  3. formHelpers.buildPayload()           ← 組裝 UpdatePostPayload
  4. postAPI.updatePost(currentPostId, payload)  ← PUT /api/posts/:id
  5. window.location.reload()
```

> **關鍵設計**：開啟 Modal 時已先 POST 建立草稿，取得 UUID。後續所有儲存均為 PUT 更新，**不會重複建立**。

---

## 四、編輯既有文章流程

```
[使用者點擊文章列表的「編輯」按鈕]
        ↓
adminDashboard.ts (edit-btn click)
  - dispatch CustomEvent("open-edit-modal", { detail: { id: "uuid" } })
        ↓
modalLogic.ts → openModal("uuid")
  1. categoryService.loadCategories()    ← GET /api/categories
  2. postAPI.getPostById(id)             ← GET /api/posts/:id
  3. formHelpers.fillForm() 填充所有欄位
  4. initEditor(post.content)            ← 載入 Editor.js
        ↓
[保存邏輯與新增相同，均走 PUT /api/posts/:id]
```

---

## 五、API 端點總覽

| 方法 | 路徑 | 用途 | 需要認證 |
|------|------|------|---------|
| GET | `/api/posts` | 取得所有文章列表 | ✅ |
| GET | `/api/posts/:id` | 取得單篇文章（by UUID 或 slug） | ✅ |
| POST | `/api/posts` | 新增文章 / 快速建立草稿 | ✅ |
| PUT | `/api/posts/:id` | 更新文章內容 | ✅ |
| DELETE | `/api/posts/:id` | 刪除文章（含封面圖） | ✅ |
| GET | `/api/categories` | 取得所有分類 | ✅ |
| POST | `/api/categories` | 新增分類 | ✅ |
| POST | `/api/upload` | 上傳封面圖至 R2 | ✅ |

---

## 六、核心資料型別

### Post（文章）
```typescript
interface Post {
  id: string;           // UUID（後端生成）
  title: string;
  author_name: string;
  slug: string;         // URL 代稱，可自訂或由標題自動生成
  content: string;      // Editor.js JSON 字串
  summary?: string;     // SEO 摘要（可留空，系統自動提取前 120 字）
  cover_image?: string; // 封面圖 URL
  cover_image_id?: string;
  status: "draft" | "published";
  created_at: string;   // ISO 8601
  updated_at: string;
  published_at?: string;
  categories: Category[];
}
```

### UpdatePostPayload（儲存時送出）
```typescript
interface UpdatePostPayload {
  title: string;
  slug?: string;           // 留空則後端由標題自動生成
  author_name: string;
  content: string;         // Editor.js JSON 字串
  summary: string;
  status: "draft" | "published";
  categories: Category[];
  cover_image?: string | object;
  published_at?: string;
}
```

### CreatePostPayload（新增草稿時送出）
```typescript
interface CreatePostPayload {
  title?: string;          // 預設「未命名文章 YYYY-MM-DD」
  author_name?: string;    // 預設從 localStorage nickname 取得
  status?: "draft" | "published";
  // cover_image_id 不傳（undefined）= 無封面，後端視為 null
}
```

---

## 七、關鍵檔案索引

### 前端（`/front/src/`）

| 檔案 | 職責 |
|------|------|
| `pages/admin/dashboard.astro` | SSR 入口，cookie 驗證、fetch 文章清單 |
| `components/PostsList.astro` | 文章列表表格，接收 props |
| `components/EditModal/EditModal.astro` | 彈窗 HTML 結構，監聽 CustomEvent |
| `components/EditModal/modalLogic.ts` | 彈窗開關、POST/PUT 流程核心邏輯 |
| `components/EditModal/categoryService.ts` | 分類載入與渲染 |
| `components/EditModal/formHelpers.ts` | 表單填充與 payload 組裝 |
| `scripts/adminDashboard.ts` | 按鈕事件綁定，透過 CustomEvent 解耦 |
| `utils/api.ts` | axios 實例，從 cookie 讀取 token |
| `utils/postAPI.ts` | 文章與分類 API 方法封裝 |
| `utils/postManager.ts` | 共用型別與工具函式 re-export |

### 後端（`/cfserver/src/`）

| 檔案 | 職責 |
|------|------|
| `modules/posts/post.controller.ts` | HTTP 請求處理、參數驗證 |
| `modules/posts/post.service.ts` | Drizzle ORM 資料庫操作、Slug 生成 |
| `modules/posts/post.route.ts` | 路由定義 |
| `modules/categories/` | 分類 CRUD（同上結構） |

---

## 八、已知問題與修正記錄（2026-09-04）

| 問題 | 原因 | 修正位置 |
|------|------|---------|
| 點「新增文章」無反應 | `CustomEvent` 未帶 `detail`，`e.detail.id` 報錯 | `adminDashboard.ts` |
| 新增文章跳「載入資料失敗」 | axios 攔截器從 localStorage 讀 token，但專案是 cookie 認證 | `api.ts` |
| 新增文章跳出後立刻 redirect | `authManager.checkAuth()` 檢查 localStorage 的 token | `adminDashboard.ts` |
| POST /api/posts 回 500 | `cover_image_id` 為 `undefined` 時後端直接拋 400 | `post.service.ts` addPost |
| PUT /api/posts 保存必定失敗 | 標題/作者型別檢查條件寫反（`=== "string"` 應為 `!== "string"`） | `post.service.ts` updatePost |
