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

export default app;
export type { Env };
