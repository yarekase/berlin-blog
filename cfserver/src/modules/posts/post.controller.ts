/**
 * ==============================================================================
 * 文章模組 - 控制器 (Post Controller)
 * ==============================================================================
 * 職責：
 * 1. 處理文章的 CRUD HTTP 請求。
 * 2. 驗證請求參數與 Path Parameters (id / slug)。
 * 3. 呼叫 postService 操作資料庫並回傳標準 JSON。
 */

import type { Context } from "hono";
import type { AppContext } from "../../types/env";
import { postService } from "./post.service";

export class PostController {
  /**
   * [GET] / - 取得文章列表
   */
  async getPosts(c: Context<AppContext>) {
    try {
      const posts = await postService.getPostsList(c.env.DB);
      return c.json(posts);
    } catch (error: any) {
      console.error("[PostController.getPosts Error]:", error);
      return c.json({ error: error.message || "取得文章列表失敗" }, 500);
    }
  }

  /**
   * [GET] /:id - 取得單篇文章
   */
  async getPostById(c: Context<AppContext>) {
    try {
      const idOrSlug = c.req.param("id");
      if (!idOrSlug) {
        return c.json({ error: "缺少文章 ID 或 Slug" }, 400);
      }

      const post = await postService.getPost(c.env.DB, idOrSlug);

      if (!post) {
        return c.json({ error: "文章不存在" }, 404);
      }

      return c.json(post);
    } catch (error: any) {
      console.error(`[PostController.getPostById Error]:`, error);
      return c.json({ error: error.message || "取得文章失敗" }, 500);
    }
  }

  /**
   * [POST] / - 新增文章或快速建立草稿
   */
  async createPost(c: Context<AppContext>) {
    try {
      const body = await c.req.json().catch(() => ({}));
      const newPost = await postService.addPost(c.env.DB, body);
      return c.json(newPost, 201);
    } catch (error: any) {
      console.error("[PostController.createPost Error]:", error);
      return c.json({ error: error.message || "新增文章失敗" }, 500);
    }
  }

  /**
   * [PUT] /:id - 更新文章內容
   */
  async updatePost(c: Context<AppContext>) {
    try {
      const id = c.req.param("id");
      if (!id) return c.json({ error: "缺少文章 ID" }, 400);

      const body = await c.req.json();
      const updated = await postService.updatePost(c.env.DB, id, body);
      return c.json({ success: true, post: updated });
    } catch (error: any) {
      console.error(`[PostController.updatePost Error]:`, error);
      return c.json({ error: error.message || "更新文章失敗" }, 500);
    }
  }

  /**
   * [DELETE] /:id - 刪除文章
   */
  async deletePost(c: Context<AppContext>) {
    try {
      const id = c.req.param("id");
      if (!id) return c.json({ error: "缺少文章 ID" }, 400);

      await postService.deletePost(c.env.DB, id);
      return c.json({ success: true, message: "文章刪除成功" });
    } catch (error: any) {
      console.error(`[PostController.deletePost Error]:`, error);
      return c.json({ error: error.message || "刪除文章失敗" }, 500);
    }
  }
}

export const postController = new PostController();
