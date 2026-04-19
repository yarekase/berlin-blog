/**
 * 文章管理工具
 * 處理文章的增刪改查和存儲
 */

import { any } from "astro:schema";

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
   * 從 D1atabase 加載文章
   */
  async getPosts(db: D1Database): Promise<Post[]> {
    const { results } = await db
      .prepare(
        `
      SELECT p.*, 
      (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug, 'sort_order', c.sort_order))
       FROM categories c
       JOIN post_categories pc ON c.id = pc.category_id
       WHERE pc.post_id = p.id) as categories
       
      FROM posts p
      ORDER BY created_at DESC
    `,
      )
      .all();

    return results.map((row: any) => {
      let parsedCategories: any[] = [];

      try {
        // 檢查 row.categories 是否存在，若不存在或不是字串則給予空陣列
        parsedCategories = row.categories
          ? JSON.parse(row.categories as string)
          : [];
      } catch (e) {
        console.error("解析分類失敗:", e);
        parsedCategories = [];
      }

      return {
        ...row,
        categories: parsedCategories,
      };
    }) as Post[];
  }

  /**
   * 新增文章 (使用 Batch 確保事務完整)
   */
  async addPost(
    db: D1Database,
    postData: {
      title: string;
      author_name: string;
      content: string;
      cover_image: string;
      status: "draft" | "published";
      categories: Category[];
    },
  ): Promise<void> {
    const id = crypto.randomUUID().substring(0, 8); // 使用隨機 UUID 防止爬蟲猜測順序
    const now = new Date().toISOString();
    const slug = this.generateSlug(postData.title);
    const summary = this.generateSummary(postData.content);
    const draft_token = crypto.randomUUID();

    const insertPost = db
      .prepare(
        `
      INSERT INTO posts (id, title, author_name, slug, content, summary, cover_image, status, draft_token, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
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
        postData.status === "published" ? now : null,
      );

    // 建立多對多關聯 SQL
    const insertRelations = postData.categories.map((cat) =>
      db
        .prepare(
          `INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)`,
        )
        .bind(id, cat.id),
    );

    await db.batch([insertPost, ...insertRelations]);
  }

  // 以下都還沒修改資料，先放在這裡，等後端做好再來改這裡的資料來源

  /**
   * 從 localStorage 加載分類(以上都還沒有改資料)
   */
  private loadCategories(): void {
    const saved = localStorage.getItem("adminCategories");
    this.categories = saved ? JSON.parse(saved) : this.getDefaultCategories();
  }

  /**
   * 獲取預設分類
   */
  private getDefaultCategories(): Category[] {
    return [
      { id: 1, name: "有品有閒", slug: "class", sort_order: 1 },
      { id: 2, name: "藝術", slug: "arts", sort_order: 2 },
      { id: 3, name: "歷史", slug: "history", sort_order: 3 },
      { id: 4, name: "政治", slug: "politics", sort_order: 4 },
      { id: 5, name: "電影", slug: "movies", sort_order: 5 },
      { id: 6, name: "閱讀", slug: "reading", sort_order: 6 },
    ];
  }

  /**
   * 保存文章到 localStorage
   */
  private savePosts(): void {
    localStorage.setItem("adminPosts", JSON.stringify(this.posts));
  }

  /**
   * 保存分類到 localStorage
   */
  private saveCategories(): void {
    localStorage.setItem("adminCategories", JSON.stringify(this.categories));
  }

  /**
   * 生成預覽 token
   */
  private generatePreviewToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
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
   * 根據 ID 獲取文章
   */
  getPost(id: string): Post | undefined {
    return this.posts.find((p) => p.id === id);
  }

  /**
   * 獲取所有分類
   */
  getCategories(): Category[] {
    return this.categories.sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * 獲取已發佈的文章數量
   */
  getPublishedCount(): number {
    return this.posts.filter((p) => p.status === "published").length;
  }

  /**
   * 獲取草稿數量
   */
  getDraftCount(): number {
    return this.posts.filter((p) => p.status === "draft").length;
  }

  /**
   * 獲取總文章數
   */
  getTotalCount(): number {
    return this.posts.length;
  }

  /**
   * 更新文章
   */
  updatePost(
    id: string,
    updates: Partial<{
      title: string;
      author_name: string;
      content: string;
      summary: string;
      cover_image: string;
      status: "draft" | "published";
      categories: Category[];
    }>,
  ): Post | undefined {
    const postIndex = this.posts.findIndex((p) => p.id === id);
    if (postIndex === -1) return undefined;

    const post = this.posts[postIndex];
    const updatedPost = {
      ...post,
      ...updates,
      slug: updates.title ? this.generateSlug(updates.title) : post.slug,
      summary: updates.content
        ? this.generateSummary(updates.content)
        : (updates.summary ?? post.summary),
      published_at:
        updates.status === "published" && post.status !== "published"
          ? new Date().toISOString()
          : post.published_at,
      updated_at: new Date().toISOString(),
    };

    this.posts[postIndex] = updatedPost;
    this.savePosts();
    return updatedPost;
  }

  /**
   * 刪除文章
   */
  deletePost(id: string): boolean {
    const index = this.posts.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.posts.splice(index, 1);
    this.savePosts();
    return true;
  }
}

export const postManager = new PostManager();
