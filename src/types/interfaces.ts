export interface Category {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

export interface Post {
  id: string; // UUID
  title: string;
  author_name: string;
  slug: string;
  content?: string; // Editor.js JSON String
  summary: string | null;
  status: "draft" | "published";
  preview_token: string;
  created_at: string;
  published_at?: string;
  updated_at: string;
  // 資料庫沒有直接存這個欄位，但在 API 回傳時會組裝進來
  cover_image?: string | null;
  categories: Category[]; // 資料庫沒有直接存這個欄位，但在 API 回傳時會組裝進來
}

export interface Image {
  id: string; // UUID
  post_id: string; // 對應的文章 ID
  original_key: string; // 原始檔案名稱
  original_url: string; // 原始檔案 URL
  webp_key: string; // WebP 檔案名稱
  webp_url: string; // WebP 檔案 URL
  is_cover: boolean; // 是否為封面圖
  sort_order: number; // 排序順序
  created_at: string;
}