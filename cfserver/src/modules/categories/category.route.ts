/**
 * ==============================================================================
 * 分類模組 - 路由定義 (Category Route)
 * ==============================================================================
 * 路由清單（前綴為 /categories）：
 * - GET  /  : 取得所有分類 (公開)
 * - POST /  : 建立新分類 (需管理員認證)
 */

import { Hono } from "hono";
import type { AppContext } from "../../types/env";
import { categoryController } from "./category.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

const categoryRoute = new Hono<AppContext>();

// 1. [公開] 取得所有分類清單
categoryRoute.get("/", (c) => categoryController.getCategories(c));

// 2. [受保護] 新增分類
categoryRoute.post("/", requireAuth, (c) => categoryController.createCategory(c));

export default categoryRoute;
