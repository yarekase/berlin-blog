/**
 * 文章管理工具
 * 處理文章的增刪改查和存儲
 */

export interface Category {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

export interface Post {
  id: string;
  title: string;
  author_name: string;
  slug: string;
  content: string; // Editor.js JSON
  summary?: string; // nullable
  cover_image: string;
  status: "draft" | "published";
  draft_token: string;
  created_at: string;
  published_at?: string; // nullable
  updated_at: string;
  categories: Category[]; // 多對多關係
}

export class PostManager {
  private posts: Post[] = [];
  private categories: Category[] = [];
  /**
   * 生成 URL slug
   * @param title
   * @returns
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * 從 Editor.js JSON 生成摘要
   */
  private generateSummary(editorData: string): string {
    try {
      const data = JSON.parse(editorData);
      let text = "";
      if (data.blocks) {
        for (const block of data.blocks) {
          if (block.type === "paragraph" || block.type === "header") {
            text += block.data.text + " ";
            if (text.length >= 100) break;
          }
        }
      }
      return text.substring(0, 100).trim();
    } catch {
      return "";
    }
  }

  /**
   * 獲取文章清單 (不包含內容，節省流量)
   * 用於後台管理表格
   */
  async getPostsList(DB: D1Database): Promise<Omit<Post, "content">[]> {
    try {
      const { results } = await DB.prepare(
        `
        SELECT id, title, author_name, slug, summary, cover_image, status, created_at, updated_at, published_at,
        (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug, 'sort_order', c.sort_order))
         FROM categories c
         JOIN post_categories pc ON c.id = pc.category_id
         WHERE pc.post_id = p.id) as categories
        FROM posts p
        ORDER BY created_at DESC
      `,
      ).all();

      return results.map((row: any) => ({
        ...row,
        categories:
          typeof row.categories === "string" ? JSON.parse(row.categories) : [],
      })) as Omit<Post, "content">[];
    } catch (error) {
      console.error("獲取清單失敗:", error);
      throw new Error("無法載入文章列表。");
    }
  }

  /**
   * 從 D1 Database 加載文章
   */
  async getPosts(DB: D1Database): Promise<Post[]> {
    try {
      const { results } = await DB.prepare(
        `
        SELECT p.*, 
        (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug, 'sort_order', c.sort_order))
         FROM categories c
         JOIN post_categories pc ON c.id = pc.category_id
         WHERE pc.post_id = p.id) as categories
         
        FROM posts p
        ORDER BY created_at DESC
      `,
      ).all();

      return results.map((row: any) => {
        let categories = [];

        if (typeof row.categories === "string") {
          try {
            categories = JSON.parse(row.categories);
          } catch (e) {
            console.error("解析分類失敗，原始資料：", row.categories, e);
          }
        }

        return {
          ...row,
          categories, // 直接覆蓋原本的字串版本
        };
      }) as Post[];
    } catch (error) {
      console.error("獲取文章列表失敗:", error);
      throw new Error("無法從資料庫獲取文章列表。");
    }
  }

  /**
   * 新增文章 (使用 Batch 確保事務完整)
   */
  async addPost(
    DB: D1Database,
    postData: {
      title: string;
      author_name: string;
      content: string;
      cover_image: string;
      status: "draft" | "published";
      categories: Category[];
      published_at?: string;
    },
  ): Promise<void> {
    try {
      const id = crypto.randomUUID(); // 使用隨機 UUID 防止爬蟲猜測順序
      const now = new Date().toISOString();
      const slug = id;
      const summary = this.generateSummary(postData.content);
      const draft_token = crypto.randomUUID();

      const insertPost = DB.prepare(
        `
        INSERT INTO posts (id, title, author_name, slug, content, summary, cover_image, status, draft_token, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).bind(
        id,
        postData.title,
        postData.author_name,
        slug,
        postData.content,
        summary,
        postData.cover_image,
        postData.status,
        draft_token,
        now,
        now,
        postData.status === "published" ? postData.published_at : null,
      );

      // 建立多對多關聯 SQL
      const insertRelations = postData.categories.map((cat) =>
        DB.prepare(
          `INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)`,
        ).bind(id, cat.id),
      );

      await DB.batch([insertPost, ...insertRelations]);
    } catch (error) {
      console.error("新增文章失敗:", error);
      throw new Error("新增文章時發生錯誤，請稍後再試。");
    }
  }

  /**
   * 根據 ID 獲取單篇文章
   */
  async getPost(DB: D1Database, id: string): Promise<Post | undefined> {
    try {
      const row = await DB.prepare(
        `
        SELECT p.*, 
        (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug, 'sort_order', c.sort_order))
         FROM categories c
         JOIN post_categories pc ON c.id = pc.category_id
         WHERE pc.post_id = p.id) as categories
        FROM posts p
        WHERE p.id = ?
      `,
      )
        .bind(id)
        .first();

      if (!row) return undefined;

      return {
        ...row,
        categories: JSON.parse(row.categories as string),
      } as Post;
    } catch (error) {
      console.error("獲取單篇文章失敗:", error);
      throw new Error(`無法獲取 ID 為 ${id} 的文章內容。`);
    }
  }

  /**
   * 更新文章
   */
  async updatePost(
    DB: D1Database,
    id: string,
    updates: Partial<{
      title: string;
      author_name: string;
      content: string;
      summary: string;
      cover_image: string;
      status: "draft" | "published";
      published_at?: string;
      categories: Category[];
    }>,
  ): Promise<void> {
    const now = new Date().toISOString();
    const batchQueries = [];

    // 1. 更新主表 (僅更新有傳入的欄位)
    if (
      updates.title ||
      updates.content ||
      updates.status ||
      updates.cover_image
    ) {
      // 這裡簡化處理，實際建議動態生成 SQL 或更新所有相關欄位
      const slug = id;
      const summary = updates.content
        ? this.generateSummary(updates.content)
        : updates.summary;

      batchQueries.push(
        DB.prepare(
          `
        UPDATE posts 
        SET 
          title = COALESCE(?, title),
          slug = COALESCE(?, slug),
          content = COALESCE(?, content),
          summary = COALESCE(?, summary),
          cover_image = COALESCE(?, cover_image),
          status = COALESCE(?, status),
          updated_at = ?,
          published_at = CASE 
            WHEN ? = 'published' AND published_at IS NULL THEN ?
            ELSE published_at
          END
        WHERE id = ?
      `,
        ).bind(
          updates.title ?? null,
          slug ?? null,
          updates.content ?? null,
          summary ?? null,
          updates.cover_image ?? null,
          updates.status ?? null,
          now,
          updates.status ?? null,
          now,
          id,
        ),
      );
    }

    // 2. 更新分類關聯 (先刪除舊的，再插入新的)
    if (updates.categories) {
      batchQueries.push(
        DB.prepare(`DELETE FROM post_categories WHERE post_id = ?`).bind(id),
      );
      updates.categories.forEach((cat) => {
        batchQueries.push(
          DB.prepare(
            `INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)`,
          ).bind(id, cat.id),
        );
      });
    }

    if (batchQueries.length > 0) {
      try {
        await DB.batch(batchQueries);
        // 成功後的邏輯，例如 console.log('更新成功');
      } catch (error) {
        // 1. 錯誤處理：記錄錯誤
        console.error("資料庫批次更新失敗:", error);

        // 2. 決定如何回報給前端
        throw new Error("更新文章時發生資料庫錯誤，請稍後再試。");
      }
    }
  }

  async deletePost(DB: D1Database, id: string): Promise<void> {
    try {
      const result = await DB.prepare(`DELETE FROM posts WHERE id = ?`)
        .bind(id)
        .run();

      if (!result.success) {
        throw new Error("資料庫執行刪除失敗");
      }

      console.log(`文章 ${id} 已成功刪除`);
    } catch (error) {
      // 錯誤處理邏輯
      console.error("執行 deletePost 時發生錯誤:", error);

      throw new Error(`無法刪除文章 (ID: ${id})，請檢查資料庫狀態。`);
    }
  }

  async getCategories(DB: D1Database): Promise<Category[]> {
    try {
      const { results } = await DB.prepare(
        `SELECT * FROM categories ORDER BY sort_order ASC`,
      ).all();

      return (results || []) as unknown as Category[];
    } catch (error) {
      console.error("無法從 D1 讀取分類資料:", error);

      throw new Error("抓取分類時發生資料庫錯誤，請稍後再試。");
    }
  }

  /**
   * 獲取儀表板數據 (總文章數、已發布數、草稿數)，依據需求再做調整
   */
  async getDashboardData(DB: D1Database) {
    try {
      const stats = await DB.prepare(
        `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft
      FROM posts
    `,
      ).first();

      return { stats };
    } catch (error) {
      console.error("獲取儀表板數據失敗:", error);
      return null;
    }
  }

  /**
   * 新增分類
   */
  async createCategory(DB: D1Database, name: string): Promise<Category> {
  // 生成 Slug
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    // 1. 檢查重複 (D1 的語法)
    const existing = await DB.prepare(
      `SELECT id FROM categories WHERE name = ? OR slug = ?`
    ).bind(name, slug).first();

    if (existing) {
      throw new Error("分類名稱或 Slug 已存在");
    }

    // 2. 插入資料
    const result = await DB.prepare(
      `INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)`
    ).bind(name, slug, 99).run();

    if (!result.success) throw new Error("資料庫寫入失敗");

    return {
      id: result.meta.last_row_id as number,
      name,
      slug,
      sort_order: 99
    };
  }
}

export const postManager = new PostManager();
