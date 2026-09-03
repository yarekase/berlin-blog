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
import { AppError } from "../../utils/appError";

export class CategoryController {
  /**
   * [GET] / - 取得全部分類清單
   */
  async getCategories(c: Context<AppContext>) {
    const categories = await categoryService.getCategories(c.env.DB);
    return c.json(categories);
  }

  /**
   * [POST] / - 新增分類
   */
  async createCategory(c: Context<AppContext>) {

    const { name } = await c.req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      throw new AppError(400, "分類名稱為必填項目");
    }

    if (name.length > 10 || name.length < 1) {
      throw new AppError(400, "分類名稱長度必須在1到10個字元之間");
    }

    const newCategory = await categoryService.createCategory(c.env.DB, name.trim());
    return c.json(newCategory, 201);
  }

  /**
   * [PUT] / - 更新分類
   */
  async updateCategory(c: Context<AppContext>) {
    const id = Number(c.req.param("id"));
    const { name, sort_order } = await c.req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      throw new AppError(400, "分類名稱為必填項目");
    }
    if (name.length > 10 || name.length < 1) {
      throw new AppError(400, "分類名稱長度必須在1到10個字元之間");
    }
    const updatedCategory = await categoryService.updateCategory(c.env.DB, id, { name: name.trim(), sort_order });
    return c.json(updatedCategory);
  }

  /**
   * [DELETE] /:id - 刪除分類
   */
  async deleteCategory(c: Context<AppContext>) {
    const id = Number(c.req.param("id"));
    await categoryService.deleteCategory(c.env.DB, id);
    return c.json({ message: "分類刪除成功" });
  }
}

export const categoryController = new CategoryController();
