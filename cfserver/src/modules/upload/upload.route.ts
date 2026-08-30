/**
 * ==============================================================================
 * 上傳模組 - 路由定義 (Upload Route)
 * ==============================================================================
 * 路由清單（前綴為 /upload）：
 * - POST / : 接收圖片並儲存至 R2 (需管理員認證)
 */

import { Hono } from "hono";
import type { AppContext } from "../../types/env";
import { uploadController } from "./upload.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

const uploadRoute = new Hono<AppContext>();

// [受保護] 上傳圖片檔案
uploadRoute.post("/", requireAuth, (c) => uploadController.upload(c));

export default uploadRoute;
