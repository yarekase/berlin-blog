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
  preview_token: string;
  created_at: string;
  published_at?: string; // nullable
  updated_at: string;
  categories: Category[]; // 多對多關係
}

class PostManager {
  private posts: Post[] = [];
  private categories: Category[] = [];

  constructor() {
    this.loadPosts();
    this.loadCategories();
  }

  /**
   * 從 localStorage 加載文章
   */
  private loadPosts(): void {
    const saved = localStorage.getItem("adminPosts");
    this.posts = saved ? JSON.parse(saved) : [];
  }

  /**
   * 從 localStorage 加載分類
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
      { id: 1, name: "Coding", slug: "coding", sort_order: 1 },
      { id: 2, name: "Finance", slug: "finance", sort_order: 2 },
      { id: 3, name: "Design", slug: "design", sort_order: 3 },
      { id: 4, name: "Kaohsiung", slug: "kaohsiung", sort_order: 4 },
      { id: 5, name: "Life", slug: "life", sort_order: 5 },
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
   * 生成 slug
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
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
   * 獲取所有文章
   */
  getPosts(): Post[] {
    return this.posts;
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
   * 新增文章
   */
  addPost(postData: {
    title: string;
    author_name: string;
    content: string;
    cover_image: string;
    status: "draft" | "published";
    categories: Category[];
  }): Post {
    const now = new Date().toISOString();
    const newPost: Post = {
      id: Date.now().toString(),
      title: postData.title,
      author_name: postData.author_name,
      slug: this.generateSlug(postData.title),
      content: postData.content,
      summary: this.generateSummary(postData.content),
      cover_image: postData.cover_image,
      status: postData.status,
      preview_token: this.generatePreviewToken(),
      created_at: now,
      published_at: postData.status === "published" ? now : undefined,
      updated_at: now,
      categories: postData.categories,
    };
    this.posts.push(newPost);
    this.savePosts();
    return newPost;
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
