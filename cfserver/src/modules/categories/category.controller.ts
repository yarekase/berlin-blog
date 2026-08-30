/**
 * ==============================================================================
 * 分類模組 - 控制器 (Category Controller)
 * ==============================================================================
 * 職責：
 * 1. 處理分類列表與建立分類請求。
 * 2. 驗證分類名稱。
 */

import type { Context } from "hono";
import type { AppContext } from "../../types/env";
import { categoryService } from "./category.service";

export class CategoryController {
  /**
   * [GET] / - 取得全部分類清單
   */
  async getCategories(c: Context<AppContext>) {
    try {
      const categories = await categoryService.getCategories(c.env.DB);
      return c.json(categories);
    } catch (error: any) {
      console.error("[CategoryController.getCategories Error]:", error);
      return c.json({ error: error.message || "取得分類清單失敗" }, 500);
    }
  }

  /**
   * [POST] / - 新增分類
   */
  async createCategory(c: Context<AppContext>) {
    try {
      const { name } = await c.req.json();
      if (!name || typeof name !== "string" || !name.trim()) {
        return c.json({ error: "分類名稱為必填項目" }, 400);
      }

      const newCategory = await categoryService.createCategory(c.env.DB, name.trim());
      return c.json(newCategory, 201);
    } catch (error: any) {
      console.error("[CategoryController.createCategory Error]:", error);
      if (error.message?.includes("已存在")) {
        return c.json({ error: error.message }, 409);
      }
      return c.json({ error: error.message || "新增分類失敗" }, 500);
    }
  }
}

export const categoryController = new CategoryController();
