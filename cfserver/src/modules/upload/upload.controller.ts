/**
 * ==============================================================================
 * 上傳模組 - 控制器 (Upload Controller)
 * ==============================================================================
 * 職責：
 * 1. 解析 multipart/form-data 請求體。
 * 2. 驗證是否有傳入 file。
 * 3. 呼叫 uploadService 寫入 R2 並回傳成功 JSON。
 */

import type { Context } from "hono";
import type { AppContext } from "../../types/env";
import { uploadService } from "./upload.service";

export class UploadController {
  /**
   * [POST] / - 上傳圖片
   */
  async upload(c: Context<AppContext>) {
    try {
      const body = await c.req.parseBody();
      const originalFile = body["file"] as File;
      const webpFile = body["webp"] as File;

      if (!originalFile) {
        return c.json({ success: 0, message: "無上傳的檔案" }, 400);
      }

      const fileData = await uploadService.uploadImage(
        c.env.MY_BUCKET,
        c.env.R2_PUBLIC_DOMAIN,
        originalFile,
        webpFile
      );

      return c.json({
        success: 1,
        file: fileData,
      });
    } catch (error: any) {
      console.error("[UploadController.upload Error]:", error);
      return c.json({ success: 0, message: error.message || "上傳失敗" }, 500);
    }
  }
}

export const uploadController = new UploadController();
