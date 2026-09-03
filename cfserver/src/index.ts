/**
 * ==============================================================================
 * Cloudflare Workers + Hono 後端 API 主入口
 * ==============================================================================
 * 職責：
 * 1. 建立 Hono App 並設定基礎路徑為 `/api`。
 * 2. 設定全域中間件 (CORS 跨來源共用)。
 * 3. 掛載各功能模組的獨立子路由 (Auth, Posts, Categories, Upload)。
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppContext, Env } from "./types/env";
import { AppError } from "./utils/appError";

// 匯入各功能模組的子路由
import authRoute from "./modules/auth/auth.route";
import postRoute from "./modules/posts/post.route";
import categoryRoute from "./modules/categories/category.route";
import uploadRoute from "./modules/upload/upload.route";

// 建立主 App 實例
const app = new Hono<AppContext>().basePath("/api");

// ==============================================================================
// 1. [全域中間件] CORS 跨來源存取設定
// ==============================================================================
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// ==============================================================================
// 2. [全域健康檢查]
// ==============================================================================
app.get("/health", (c) =>
  c.json({
    status: "ok",
    message: "Berlin Blog API is up and running!",
    timestamp: new Date().toISOString(),
  })
);

// ==============================================================================
// 3. [模組子路由掛載]
// ==============================================================================

// 認證模組：支援 /api/login, /api/profile 及 /api/auth/login, /api/auth/profile
app.route("/", authRoute);
app.route("/auth", authRoute);

// 文章模組：支援 /api/posts, /api/posts/:id (包含 CRUD 操作)
app.route("/posts", postRoute);

// 分類模組：支援 /api/categories (列表與新增)
app.route("/categories", categoryRoute);

// 上傳模組：支援 /api/upload (圖片儲存至 R2)
app.route("/upload", uploadRoute);

// ==============================================================================
// 4. [全域錯誤處理 (Global Error Handling)]
// ==============================================================================

// 統一處理 API 拋出的錯誤 (包含自訂 AppError 與未預期的系統錯誤)
app.onError((err, c) => {
  // 1. 處理預期的商業邏輯錯誤 (AppError)
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: err.message,
      },
      err.statusCode as any
    );
  }

  // 2. 處理未預期的系統錯誤 (如 D1 查詢崩潰、語法錯誤等)
  console.error(`[Unhandled Error] [${c.req.method} ${c.req.url}]:`, err);

  return c.json(
    {
      success: false,
      error: "系統內部錯誤，請稍後再試",
    },
    500
  );
});

// 統一處理 404 Not Found (打到未定義的 API 路由時)
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: `請求的資源不存在: ${c.req.method} ${c.req.path}`,
    },
    404
  );
});

export default app;
export type { Env };
