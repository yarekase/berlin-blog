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

// 3. [受保護] 更新分類
categoryRoute.put("/:id", requireAuth, (c) => categoryController.updateCategory(c));

// 4. [受保護] 刪除分類
categoryRoute.delete("/:id", requireAuth, (c) => categoryController.deleteCategory(c));

export default categoryRoute;
