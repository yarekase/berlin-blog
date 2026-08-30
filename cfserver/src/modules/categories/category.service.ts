/**
 * ==============================================================================
 * 分類模組 - 資料服務層 (Category Service with Drizzle ORM)
 * ==============================================================================
 * 職責：
 * 1. 查詢全部分類。
 * 2. 新增分類（含 Slug 正規化與重複檢查）。
 */

import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import * as schema from "../../db/schema";

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
      throw new Error("分類名稱或 Slug 已存在");
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
}

export const categoryService = new CategoryService();
