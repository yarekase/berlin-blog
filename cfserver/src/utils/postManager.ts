/**
 * ==============================================================================
 * 文章管理服務模組 (Post Service with Drizzle ORM)
 * ==============================================================================
 * 本模組負責所有與「文章」、「分類」以及「多對多關聯」相關的資料庫操作。
 * 完全使用 Drizzle ORM 進行類型安全 (Type-safe) 的查詢、插入、更新與刪除。
 * 
 * [Slug 策略]：
 * - 預設直接採用中文標題正規化（不加 UUID），保留繁體中文與英數字元。
 * - 支援後台自訂 Slug 選項。
 * - 若發生 Slug 衝突，自動追加遞增後綴 (-2, -3...) 確保唯一性。
 */

import { eq, or, desc, sql } from "drizzle-orm";
import { getDb, type DbType } from "../db";
import * as schema from "../db/schema";

// ------------------------------------------------------------------------------
// TypeScript 介面定義
// ------------------------------------------------------------------------------

/** 分類介面 (與資料庫 categories 表及前端對齊) */
export interface Category {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

/** 文章介面 (回傳給前端的標準文章結構) */
export interface PostResponse {
  id: string;
  title: string;
  author_name: string;
  slug: string;
  content: string; // Editor.js JSON 字串或 HTML
  summary?: string | null;
  cover_image?: string | null; // 封面圖網址或 ID
  cover_image_id?: string | null;
  status: "draft" | "published";
  draft_token?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  categories: Category[]; // 關聯的多個分類
}

/** 新增文章 Payload */
export interface CreatePostInput {
  title?: string;
  author_name?: string;
  slug?: string;
  content?: string;
  summary?: string;
  cover_image?: string | {
    original_key: string;
    original_url: string;
    webp_key?: string | null;
    webp_url?: string | null;
  };
  status?: "draft" | "published";
  categories?: { id: number }[];
  published_at?: string;
}

/** 更新文章 Payload */
export interface UpdatePostInput {
  title?: string;
  author_name?: string;
  slug?: string;
  content?: string;
  summary?: string;
  cover_image?: string | {
    original_key: string;
    original_url: string;
    webp_key?: string | null;
    webp_url?: string | null;
  };
  status?: "draft" | "published";
  categories?: { id: number }[];
  published_at?: string;
}

// ------------------------------------------------------------------------------
// 文章管理核心類別
// ------------------------------------------------------------------------------
export class PostManager {
  /**
   * 生成 URL 友善的 Slug (支援繁簡中文、英文、數字、連字號)
   * @param text 來源字串（例如標題或使用者自訂 slug）
   */
  public generateSlug(text: string): string {
    const cleaned = text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-\u4e00-\u9fa5]/g, "") // 保留英數、減號、中文字
      .replace(/[\s_]+/g, "-")               // 將空格及底線轉為連字號
      .replace(/-+/g, "-")                   // 連續減號轉為單一減號
      .replace(/^-+|-+$/g, "");              // 去除首尾減號
    
    return cleaned || "post";
  }

  /**
   * 確保 Slug 唯一性：若資料庫已存在相同 Slug，則自動遞增後綴 (-2, -3...)
   * @param db Drizzle ORM 資料庫實例
   * @param baseSlug 欲設定的基礎 Slug
   * @param excludePostId 排除當前正在更新的文章 ID
   */
  private async ensureUniqueSlug(
    db: DbType,
    baseSlug: string,
    excludePostId?: string
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await db.query.posts.findFirst({
        where: eq(schema.posts.slug, slug),
        columns: { id: true, slug: true },
      });

      // 若未發生衝突，或者衝突的剛好是同一篇文章本身，則此 slug 可用
      if (!existing || (excludePostId && existing.id === excludePostId)) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  /**
   * 從 Editor.js JSON 內容中擷取純文字摘要 (前 120 字)
   * @param editorData JSON 字串
   */
  private generateSummary(editorData: string): string {
    try {
      const data = JSON.parse(editorData);
      let text = "";
      if (Array.isArray(data.blocks)) {
        for (const block of data.blocks) {
          if (block.type === "paragraph" || block.type === "header") {
            const blockText = (block.data?.text || "").replace(/<[^>]*>?/gm, "");
            text += blockText + " ";
            if (text.length >= 120) break;
          }
        }
      }
      return text.substring(0, 120).trim();
    } catch {
      // 若非 Editor.js JSON (例如純文字或 HTML)，簡單移除 HTML 標籤後截取
      return editorData.replace(/<[^>]*>?/gm, "").substring(0, 120).trim();
    }
  }

  /**
   * 格式化資料庫查詢結果，將關聯的 postCategories 展平成乾淨的 categories 陣列
   * 同時統一欄位名稱（支援 snake_case 與前端銜接）
   */
  private formatPostResponse(row: any): PostResponse {
    // 展平多對多分類關聯
    const categories: Category[] = (row.postCategories || [])
      .map((pc: any) => pc.category)
      .filter(Boolean)
      .map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        sort_order: cat.sortOrder ?? cat.sort_order ?? 99,
      }));

    // 封面圖片 URL：優先使用 images 關聯的 webpUrl / originalUrl，其次使用 coverImageId
    const coverUrl =
      row.coverImage?.webpUrl ||
      row.coverImage?.originalUrl ||
      row.coverImageId ||
      row.cover_image ||
      null;

    return {
      id: row.id,
      title: row.title,
      author_name: row.authorName ?? row.author_name ?? "",
      slug: row.slug,
      content: row.content ?? "",
      summary: row.summary ?? null,
      cover_image: coverUrl,
      cover_image_id: row.coverImageId ?? row.cover_image_id ?? null,
      status: row.status,
      draft_token: row.draftToken ?? row.draft_token ?? null,
      created_at: row.createdAt ?? row.created_at ?? "",
      updated_at: row.updatedAt ?? row.updated_at ?? "",
      published_at: row.publishedAt ?? row.published_at ?? null,
      categories,
    };
  }

  /**
   * ============================================================================
   * 1. [查詢文章列表] GET ALL POSTS
   * ============================================================================
   * 使用 Drizzle Relational Queries 預先關聯分類與封面圖，並依建立時間倒序排序。
   */
  async getPostsList(D1: D1Database): Promise<PostResponse[]> {
    const db = getDb(D1);
    try {
      const postsData = await db.query.posts.findMany({
        orderBy: [desc(schema.posts.createdAt)],
        with: {
          postCategories: {
            with: {
              category: true,
            },
          },
          coverImage: true,
        },
      });

      return postsData.map((p) => this.formatPostResponse(p));
    } catch (error) {
      console.error("[Drizzle Error] 獲取文章列表失敗:", error);
      throw new Error("無法從資料庫獲取文章列表。");
    }
  }

  /**
   * ============================================================================
   * 2. [查詢單篇文章] GET POST BY ID OR SLUG
   * ============================================================================
   * 支援以 UUID 或自訂中文 Slug 查詢文章完整資訊與分類列表。
   */
  async getPost(D1: D1Database, idOrSlug: string): Promise<PostResponse | undefined> {
    const db = getDb(D1);
    try {
      const postData = await db.query.posts.findFirst({
        where: or(eq(schema.posts.id, idOrSlug), eq(schema.posts.slug, idOrSlug)),
        with: {
          postCategories: {
            with: {
              category: true,
            },
          },
          coverImage: true,
          images: true,
        },
      });

      if (!postData) return undefined;
      return this.formatPostResponse(postData);
    } catch (error) {
      console.error(`[Drizzle Error] 獲取文章: ${idOrSlug} 失敗:`, error);
      throw new Error(`無法獲取文章內容。`);
    }
  }

  /**
   * ============================================================================
   * 3. [新增文章 / 草稿] CREATE POST (Drizzle INSERT)
   * ============================================================================
   * 建立新文章。Slug 優先採用自訂 Slug，留空則預設採用中文標題（防衝突自動遞增後綴）。
   */
  async addPost(D1: D1Database, input: CreatePostInput): Promise<PostResponse> {
    const db = getDb(D1);
    try {
      const id = crypto.randomUUID();
      const title = input.title?.trim() || "未命名文章";
      const authorName = input.author_name?.trim() || "子迂";
      
      // Slug 生成：優先取自訂 input.slug，無自訂則依中文標題生成
      const rawSlug = input.slug?.trim()
        ? this.generateSlug(input.slug)
        : this.generateSlug(title);
      const slug = await this.ensureUniqueSlug(db, rawSlug);

      const content = input.content || JSON.stringify({ blocks: [] });
      const summary = input.summary || this.generateSummary(content);
      const status = input.status || "draft";
      const draftToken = crypto.randomUUID();
      const now = new Date().toISOString();

      // 處理封面圖 (若是物件則提取 URL/Key，若是字串則直接採用)
      let coverImageId: string | null = null;
      if (typeof input.cover_image === "string") {
        coverImageId = input.cover_image;
      } else if (input.cover_image && typeof input.cover_image === "object") {
        coverImageId = input.cover_image.webp_url || input.cover_image.original_url || null;
      }

      // 1. 插入文章主表
      await db.insert(schema.posts).values({
        id,
        title,
        authorName,
        slug,
        content,
        summary,
        coverImageId,
        status,
        draftToken,
        createdAt: now,
        updatedAt: now,
        publishedAt: status === "published" ? (input.published_at || now) : null,
      });

      // 2. 插入分類關聯 (若有提供分類 ID)
      if (input.categories && input.categories.length > 0) {
        const relations = input.categories.map((cat) => ({
          postId: id,
          categoryId: cat.id,
        }));
        await db.insert(schema.postCategories).values(relations);
      }

      // 3. 重新載入並回傳新建完成的文章
      const createdPost = await this.getPost(D1, id);
      if (!createdPost) {
        throw new Error("文章建立成功但讀取失敗");
      }
      return createdPost;
    } catch (error) {
      console.error("[Drizzle Error] 新增文章失敗:", error);
      throw new Error("新增文章時發生錯誤，請稍後再試。");
    }
  }

  /**
   * ============================================================================
   * 4. [更新文章] UPDATE POST (Drizzle UPDATE)
   * ============================================================================
   * 更新指定文章的欄位，並同步更新多對多分類關聯。
   */
  async updatePost(
    D1: D1Database,
    id: string,
    updates: UpdatePostInput
  ): Promise<PostResponse> {
    const db = getDb(D1);
    try {
      const now = new Date().toISOString();
      const updateData: Partial<typeof schema.posts.$inferInsert> = {
        updatedAt: now,
      };

      if (updates.title !== undefined) {
        updateData.title = updates.title;
      }

      // 處理 Slug：若有明確傳入 slug 則更新；若無則保留既有 slug 避免破壞外部鏈接
      if (updates.slug !== undefined && updates.slug.trim() !== "") {
        const rawSlug = this.generateSlug(updates.slug);
        updateData.slug = await this.ensureUniqueSlug(db, rawSlug, id);
      }

      if (updates.author_name !== undefined) updateData.authorName = updates.author_name;
      if (updates.content !== undefined) {
        updateData.content = updates.content;
        updateData.summary = updates.summary || this.generateSummary(updates.content);
      } else if (updates.summary !== undefined) {
        updateData.summary = updates.summary;
      }

      // 處理封面圖片
      if (updates.cover_image !== undefined) {
        if (typeof updates.cover_image === "string") {
          updateData.coverImageId = updates.cover_image;
        } else if (updates.cover_image && typeof updates.cover_image === "object") {
          updateData.coverImageId =
            updates.cover_image.webp_url || updates.cover_image.original_url || null;
        } else {
          updateData.coverImageId = null;
        }
      }

      // 處理發布狀態與時間
      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === "published") {
          updateData.publishedAt = updates.published_at || now;
        }
      }

      // 1. 執行文章主表更新
      await db.update(schema.posts).set(updateData).where(eq(schema.posts.id, id));

      // 2. 更新分類關聯 (先清除舊關聯，再寫入新關聯)
      if (updates.categories !== undefined) {
        await db.delete(schema.postCategories).where(eq(schema.postCategories.postId, id));

        if (updates.categories.length > 0) {
          const relations = updates.categories.map((cat) => ({
            postId: id,
            categoryId: cat.id,
          }));
          await db.insert(schema.postCategories).values(relations);
        }
      }

      // 3. 回傳最新文章資料
      const updatedPost = await this.getPost(D1, id);
      if (!updatedPost) {
        throw new Error("更新完成但找不到該文章");
      }
      return updatedPost;
    } catch (error) {
      console.error(`[Drizzle Error] 更新文章 ID: ${id} 失敗:`, error);
      throw new Error("更新文章時發生資料庫錯誤，請稍後再試。");
    }
  }

  /**
   * ============================================================================
   * 5. [刪除文章] DELETE POST (Drizzle DELETE)
   * ============================================================================
   * 刪除指定文章。外鍵約束 (CASCADE) 會自動連帶刪除 post_categories 及 images。
   */
  async deletePost(D1: D1Database, id: string): Promise<void> {
    const db = getDb(D1);
    try {
      await db.delete(schema.posts).where(eq(schema.posts.id, id));
      console.log(`[Drizzle] 文章 ${id} 已成功刪除`);
    } catch (error) {
      console.error(`[Drizzle Error] 刪除文章 ID: ${id} 失敗:`, error);
      throw new Error(`無法刪除文章 (ID: ${id})，請檢查資料庫狀態。`);
    }
  }

  /**
   * ============================================================================
   * 6. [取得所有分類] GET ALL CATEGORIES
   * ============================================================================
   */
  async getCategories(D1: D1Database): Promise<Category[]> {
    const db = getDb(D1);
    try {
      const results = await db.query.categories.findMany({
        orderBy: [schema.categories.sortOrder],
      });

      return results.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        sort_order: cat.sortOrder,
      }));
    } catch (error) {
      console.error("[Drizzle Error] 讀取分類資料失敗:", error);
      throw new Error("抓取分類時發生資料庫錯誤，請稍後再試。");
    }
  }

  /**
   * ============================================================================
   * 7. [新增分類] CREATE CATEGORY
   * ============================================================================
   */
  async createCategory(D1: D1Database, name: string): Promise<Category> {
    const db = getDb(D1);
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    try {
      // 檢查是否已存在相同名稱或 slug
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
    } catch (error: any) {
      console.error("[Drizzle Error] 新增分類失敗:", error);
      throw new Error(error.message || "資料庫寫入失敗");
    }
  }

  /**
   * ============================================================================
   * 8. [儀表板統計資訊] GET DASHBOARD DATA
   * ============================================================================
   */
  async getDashboardData(D1: D1Database) {
    const db = getDb(D1);
    try {
      const stats = await db
        .select({
          total: sql<number>`COUNT(*)`,
          published: sql<number>`COUNT(CASE WHEN ${schema.posts.status} = 'published' THEN 1 END)`,
          draft: sql<number>`COUNT(CASE WHEN ${schema.posts.status} = 'draft' THEN 1 END)`,
        })
        .from(schema.posts);

      return { stats: stats[0] || { total: 0, published: 0, draft: 0 } };
    } catch (error) {
      console.error("[Drizzle Error] 獲取儀表板數據失敗:", error);
      return null;
    }
  }
}

export const postManager = new PostManager();
