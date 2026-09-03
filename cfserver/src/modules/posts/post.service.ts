/**
 * ==============================================================================
 * 文章模組 - 資料服務層 (Post Service with Drizzle ORM)
 * ==============================================================================
 * 職責：
 * 1. 封裝所有與 posts, post_categories, images 相關的 Drizzle ORM 資料庫操作。
 * 2. 處理 Slug 生成（預設中文、自訂支援、自動防衝突）。
 * 3. 處理 Editor.js 摘要提取與關聯資料展開。
 */

import { eq, or, desc, sql } from "drizzle-orm";
import { getDb, type DbType } from "../../db";
import * as schema from "../../db/schema";
import { AppError } from "../../utils/appError";

export interface CategoryDto {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

export interface PostResponse {
  id: string;
  title: string;
  author_name: string;
  slug: string;
  content: string;
  summary?: string | null;
  cover_image?: string | null;
  cover_image_id?: string | null;
  status: "draft" | "published";
  draft_token?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  categories: CategoryDto[];
}

export interface CreatePostDto {
  title?: string;
  author_name?: string;
  slug?: string;
  content?: string;
  summary?: string;
  cover_image_id?: string;
  status?: "draft" | "published";
  categories?: { id: number }[];
  published_at?: string;
}

export interface UpdatePostDto {
  title?: string;
  author_name?: string;
  slug?: string;
  content?: string;
  summary?: string;
  cover_image_id?: string | null;
  status?: "draft" | "published";
  categories?: { id: number }[];
  published_at?: string;
}

export class PostService {
  /**
   * 生成 URL 友善的 Slug (支援繁簡中文、英文、數字、連字號)
   */
  public generateSlug(text: string): string {
    const cleaned = text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-\u4e00-\u9fa5]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    return cleaned || "post";
  }

  /**
   * 確保 Slug 唯一性：若資料庫已存在相同 Slug，則自動遞增後綴 (-2, -3...)
   * 目前存在格式問題，請盡量保持標題或slug的獨立性
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

      if (!existing || (excludePostId && existing.id === excludePostId)) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  /**
   * 從 Editor.js JSON 提取前 120 字作為純文字摘要
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
      return editorData.replace(/<[^>]*>?/gm, "").substring(0, 120).trim();
    }
  }

  /**
   * 格式化關聯資料庫行
   */
  private formatPost(row: any): PostResponse {
    const categories: CategoryDto[] = (row.postCategories || [])
      .map((pc: any) => pc.category)
      .filter(Boolean)
      .map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        sort_order: cat.sortOrder ?? cat.sort_order ?? 99,
      }));

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
   * [查詢] 獲取所有文章列表
   */
  async getPostsList(D1: D1Database): Promise<PostResponse[]> {
    const db = getDb(D1);
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

    return postsData.map((p) => this.formatPost(p));
  }

  /**
   * [查詢] 依 ID 或 Slug 獲取單篇文章
   */
  async getPost(D1: D1Database, idOrSlug: string): Promise<PostResponse | undefined> {
    const db = getDb(D1);
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
    return this.formatPost(postData);
  }

  /**
   * [新增] 新增文章或快速建立草稿
   */
  async addPost(D1: D1Database, input: CreatePostDto): Promise<PostResponse> {
    const db = getDb(D1);
    const id = crypto.randomUUID();
    const title = input.title?.trim() || "未命名文章";
    const authorName = input.author_name?.trim() || "子迂";

    console.log("傳進來的資料為:", input);

    const rawSlug = input.slug?.trim()
      ? this.generateSlug(input.slug)
      : this.generateSlug(title);
    const slug = await this.ensureUniqueSlug(db, rawSlug);

    const content = input.content || JSON.stringify({ blocks: [] });
    const summary = input.summary || this.generateSummary(content);
    const status = input.status || "draft";
    const draftToken = crypto.randomUUID();
    const now = new Date().toISOString();

    let coverImageId: string | null = null;
    if (typeof input.cover_image_id === "string") {
      // 有傳入圖片 ID，驗證是否存在
      const existing = await db.query.images.findFirst({
        where: eq(schema.images.id, input.cover_image_id),
      });
      if (existing) {
        coverImageId = input.cover_image_id;
      } else {
        throw new AppError(404, "圖片不存在");
      }
    }
    // cover_image_id 為 null 或 undefined（新增草稿時不傳封面）都視為無封面
    // coverImageId 預設已是 null，不需額外處理

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

    // 2. 插入分類關聯
    if (input.categories && input.categories.length > 0) {
      const relations = input.categories.map((cat) => ({
        postId: id,
        categoryId: cat.id,
      }));
      await db.insert(schema.postCategories).values(relations);
    }

    const createdPost = await this.getPost(D1, id);
    if (!createdPost) throw new Error("文章建立成功但讀取失敗");
    return createdPost;
  }

  /**
   * [更新] 更新文章資料與分類
   */
  async updatePost(
    D1: D1Database,
    id: string,
    updates: UpdatePostDto
  ): Promise<PostResponse> {
    const db = getDb(D1);
    const now = new Date().toISOString();
    const updateData: Partial<typeof schema.posts.$inferInsert> = {
      updatedAt: now,
    };

    // 全域格式檢查
    if (updates.title === undefined ||
      updates.slug === undefined ||
      updates.author_name === undefined ||
      updates.content === undefined ||
      updates.summary === undefined ||

      updates.status === undefined) throw new AppError(400, "前端格式錯誤");

    // 標題
    if (!updates.title || typeof updates.title !== "string") throw new AppError(400, "標題不可為空");
    updateData.title = updates.title;

    // 網址(若為空值或無法解析，則根據標題生成)
    const slug = updates.slug?.trim() || "";
    if (slug === "") {
      const rawSlug = this.generateSlug(updates.title);
      updates.slug = await this.ensureUniqueSlug(db, rawSlug);
    } else {
      updates.slug = await this.ensureUniqueSlug(db, slug);
    }
    updateData.slug = updates.slug;

    // 作者
    if (!updates.author_name || typeof updates.author_name !== "string") throw new AppError(400, "作者不可為空");
    updateData.authorName = updates.author_name;

    // 內容與摘要直接給上，前端傳什麼後端就存什麼
    updateData.content = updates.content;
    updateData.summary = updates.summary;

    // 封面(有值就查資料庫後給值，沒值就設 null，不能是 undefined)
    if (typeof updates.cover_image_id === "string") {
      const existingCoverImage = db.query.images.findFirst({
        where: eq(schema.images.id, updates.cover_image_id),
      });
      if (!existingCoverImage) throw new AppError(400, "圖片不存在");
      updateData.coverImageId = updates.cover_image_id;
    } else {
      updateData.coverImageId = null;
    }


    // 狀態(有值就更新，沒值就忽略)
    updateData.status = updates.status;

    // 若為 published 且給了 published_at，則使用目前時間
    if (updates.status === "published") {
      updateData.publishedAt = updates.published_at || now;
    }

    // 1. 更新主表
    await db.update(schema.posts).set(updateData).where(eq(schema.posts.id, id));

    // 2. 更新分類關聯
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

    const updated = await this.getPost(D1, id);
    if (!updated) throw new Error("更新完成但找不到該文章");
    return updated;
  }

  /**
   * [刪除] 刪除指定文章(包含刪除封面圖)
   */
  async deletePost(D1: D1Database, id: string): Promise<void> {
    const db = getDb(D1);
    const postData = await db.query.posts.findFirst({
      where: eq(schema.posts.id, id),
    });

    if (!postData) throw new AppError(404, "文章不存在");

    await db.delete(schema.posts).where(eq(schema.posts.id, id));

    if (postData.coverImageId) {
      await db.delete(schema.images).where(eq(schema.images.id, postData.coverImageId));
    }
  }
}

export const postService = new PostService();
