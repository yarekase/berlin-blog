/**
 * ==============================================================================
 * 文章與分類 API 客戶端服務 (Post & Category API Client)
 * ==============================================================================
 * 負責前端與 Cloudflare Workers 後端 API (/api/posts, /api/categories 等) 的通訊
 * 封裝了 Axios 實例 (自動附帶 JWT Authorization Header 與錯誤攔截)
 */

import api from "./api";
import type {
  Post,
  Category,
  CreatePostPayload,
  UpdatePostPayload,
} from "../types/post";

export const postAPI = {
  /**
   * ============================================================================
   * 1. 取得所有文章列表
   * ============================================================================
   * GET /api/posts
   * @returns 文章列表陣列
   */
  async getPosts(): Promise<Post[]> {
    const response = await api.get<Post[]>("/posts");
    return response.data;
  },

  /**
   * ============================================================================
   * 2. 依 ID 取得單一文章詳細內容
   * ============================================================================
   * GET /api/posts/:id
   * @param id 文章 UUID
   * @returns 單篇文章完整資料
   */
  async getPostById(id: string): Promise<Post> {
    const response = await api.get<Post>(`/posts/${id}`);
    return response.data;
  },

  /**
   * ============================================================================
   * 3. 新增文章或快速建立草稿
   * ============================================================================
   * POST /api/posts
   * @param payload 文章基本資料 (可傳空物件或初始草稿資料)
   * @returns 後端 D1 建立成功之文章物件 (含後端生成之 UUID id)
   */
  async createPost(payload: CreatePostPayload = {}): Promise<Post> {
    const response = await api.post<Post>("/posts", payload);
    return response.data;
  },

  /**
   * ============================================================================
   * 4. 更新文章
   * ============================================================================
   * PUT /api/posts/:id
   * @param id 文章 UUID
   * @param payload 更新欄位資料 (標題、內容、摘要、分類、發布狀態等)
   * @returns 更新後之文章物件或回應
   */
  async updatePost(
    id: string,
    payload: UpdatePostPayload
  ): Promise<{ success: boolean; post: Post }> {
    const response = await api.put<{ success: boolean; post: Post }>(
      `/posts/${id}`,
      payload
    );
    return response.data;
  },

  /**
   * ============================================================================
   * 5. 刪除文章
   * ============================================================================
   * DELETE /api/posts/:id
   * @param id 文章 UUID
   */
  async deletePost(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/posts/${id}`
    );
    return response.data;
  },

  /**
   * ============================================================================
   * 6. 取得所有文章分類
   * ============================================================================
   * GET /api/categories
   * @returns 分類陣列
   */
  async getCategories(): Promise<Category[]> {
    const response = await api.get<Category[]>("/categories");
    return response.data;
  },

  /**
   * ============================================================================
   * 7. 新增文章分類
   * ============================================================================
   * POST /api/categories
   * @param name 分類名稱
   * @returns 新建立之分類物件
   */
  async createCategory(name: string): Promise<Category> {
    const response = await api.post<Category>("/categories", { name });
    return response.data;
  },

  /**
   * ============================================================================
   * 8. 上傳封面圖片至 Cloudflare R2
   * ============================================================================
   * POST /api/upload
   * @param file 圖片檔案
   * @param webpFile 最佳化後的 WebP 檔案 (選填)
   */
  async uploadImage(file: File, webpFile?: File) {
    const formData = new FormData();
    formData.append("file", file);
    if (webpFile) {
      formData.append("webp", webpFile);
    }
    const response = await api.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

export default postAPI;