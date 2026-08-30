/**
 * ==============================================================================
 * 前端資料型別定義 (Post & Category Types)
 * ==============================================================================
 * 與 Cloudflare Workers 後端 Drizzle ORM 資料庫 Schema 完全對齊
 */

/** 文章分類介面 */
export interface Category {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

/** 前端標準文章介面 */
export interface Post {
  id: string; // UUID
  title: string;
  author_name: string;
  slug: string;
  content: string; // Editor.js JSON 字串或 HTML
  summary?: string | null;
  cover_image?: string | null; // 封面圖 URL
  cover_image_id?: string | null;
  status: "draft" | "published";
  draft_token?: string | null;
  categories: Category[]; // 關聯之分類陣列
  created_at: string;
  published_at?: string | null;
  updated_at: string;
}

/** 建立文章/草稿之請求 Payload */
export interface CreatePostPayload {
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

/** 更新文章之請求 Payload */
export interface UpdatePostPayload {
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

/** 儀表板統計數據介面 */
export interface DashboardStats {
  total: number;
  published: number;
  draft: number;
}
