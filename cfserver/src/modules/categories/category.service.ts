/**
 * ==============================================================================
 * 分類模組 - 資料服務層 (Category Service with Drizzle ORM)
 * ==============================================================================
 * 職責：
 * 1. 查詢全部分類。
 * 2. 新增分類（含 Slug 正規化與重複檢查）。
 * 3. 更新分類名稱與排序。
 * 4. 刪除分類（post_categories 關聯 cascade 自動處理）。
 */

import { sql, eq } from "drizzle-orm";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { AppError } from "../../utils/appError";

export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

export class CategoryService {
  /**
   * 取得全部分類（依 sort_order 排序）
   */
  async getCategories(D1: D1Database): Promise<CategoryItem[]> {
    const db = getDb(D1);
    const results = await db.query.categories.findMany({
      orderBy: [schema.categories.sortOrder],
    });

    return results.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      sort_order: cat.sortOrder,
    }));
  }

  /**
   * 建立新分類
   */
  async createCategory(D1: D1Database, name: string): Promise<CategoryItem> {
    const db = getDb(D1);
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    const existing = await db.query.categories.findFirst({
      where: sql`${schema.categories.name} = ${name} OR ${schema.categories.slug} = ${slug}`,
    });

    if (existing) {
      throw new AppError(409, "分類名稱或 Slug 已存在");
    }

    const [inserted] = await db
      .insert(schema.categories)
      .values({
        name,
        slug,
        sortOrder: 99,
      })
      .returning();

    return {
      id: inserted.id,
      name: inserted.name,
      slug: inserted.slug,
      sort_order: inserted.sortOrder,
    };
  }

  /**
   * 更新分類名稱與排序
   */
  async updateCategory(
    D1: D1Database,
    id: number,
    updates: { name?: string; sort_order?: number }
  ): Promise<CategoryItem> {
    const db = getDb(D1);

    const existing = await db.query.categories.findFirst({
      where: eq(schema.categories.id, id),
    });

    if (!existing) {
      throw new AppError(404, "找不到指定的分類");
    }

    const updateData: Partial<typeof schema.categories.$inferInsert> = {};

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) {
        throw new AppError(400, "分類名稱不可為空");
      }
      const slug = trimmedName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");

      const conflict = await db.query.categories.findFirst({
        where: sql`(${schema.categories.name} = ${trimmedName} OR ${schema.categories.slug} = ${slug}) AND ${schema.categories.id} != ${id}`,
      });

      if (conflict) {
        throw new AppError(409, "分類名稱或 Slug 已被其他分類使用");
      }

      updateData.name = trimmedName;
      updateData.slug = slug;
    }

    if (updates.sort_order !== undefined) {
      updateData.sortOrder = updates.sort_order;
    }

    const [updated] = await db
      .update(schema.categories)
      .set(updateData)
      .where(eq(schema.categories.id, id))
      .returning();

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      sort_order: updated.sortOrder,
    };
  }

  /**
   * 刪除分類（post_categories 關聯已設 cascade 自動清除）
   */
  async deleteCategory(D1: D1Database, id: number): Promise<void> {
    const db = getDb(D1);
    const existing = await db.query.categories.findFirst({
      where: eq(schema.categories.id, id),
    });

    if (!existing) {
      throw new AppError(404, "找不到指定的分類");
    }

    await db.delete(schema.categories).where(eq(schema.categories.id, id));
  }
}

export const categoryService = new CategoryService();
