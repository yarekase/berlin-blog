/**
 * ==============================================================================
 * 文章模組 - 路由定義 (Post Route)
 * ==============================================================================
 * 路由清單（前綴為 /posts）：
 * - GET    /       : 獲取所有文章列表 (公開)
 * - GET    /:id    : 獲取單篇文章詳細 (公開，支援 ID 與 中文 Slug)
 * - POST   /       : 建立新文章/草稿 (需管理員認證)
 * - PUT    /:id    : 更新文章資料 (需管理員認證)
 * - DELETE /:id    : 刪除指定文章 (需管理員認證)
 */

import { Hono } from "hono";
import type { AppContext } from "../../types/env";
import { postController } from "./post.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

const postRoute = new Hono<AppContext>();

// 1. [公開] 文章列表查詢
postRoute.get("/", (c) => postController.getPosts(c));

// 2. [公開] 單篇文章查詢 (支援 UUID 與中文 Slug)
postRoute.get("/:id", (c) => postController.getPostById(c));

// 3. [受保護] 新增文章（開啟空白文章）
postRoute.post("/", requireAuth, (c) => postController.createPost(c));

// 4. [受保護] 更新文章
postRoute.put("/:id", requireAuth, (c) => postController.updatePost(c));

// 5. [受保護] 刪除文章
postRoute.delete("/:id", requireAuth, (c) => postController.deletePost(c));

export default postRoute;
