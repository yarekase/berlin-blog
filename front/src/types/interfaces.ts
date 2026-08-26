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
  content: string; // Editor.js JSON String
  summary: string;
  cover_image: string;
  status: "draft" | "published";
  preview_token: string;
  category_ids: number[]; // 對應中間表 post_categories 的關聯
  created_at: string;
  published_at?: string;
  updated_at: string;
}
