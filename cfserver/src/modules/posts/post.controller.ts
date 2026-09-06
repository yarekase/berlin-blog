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
import { AppError } from "../../utils/appError";

export class PostController {
  /**
   * [GET] / - 取得文章列表
   */
  async getPosts(c: Context<AppContext>) {

    const posts = await postService.getPostsList(c.env.DB);
    return c.json(posts);
  }

  /**
   * [GET] /:id - 取得單篇文章
   */
  async getPostById(c: Context<AppContext>) {

    const idOrSlug = c.req.param("id");
    if (!idOrSlug) {
      throw new AppError(400, "缺少文章 ID 或 Slug");
    }

    const post = await postService.getPost(c.env.DB, idOrSlug);

    if (!post) {
      throw new AppError(404, "文章不存在");
    }

    return c.json(post);

  }

  /**
   * [POST] / - 新增文章或快速建立草稿
   */
  async createPost(c: Context<AppContext>) {

    const body = await c.req.json().catch(() => ({}));
    const newPost = await postService.addPost(c.env.DB, body);
    return c.json(newPost, 201);

  }

  /**
   * [PUT] /:id - 更新文章內容
   */
  async updatePost(c: Context<AppContext>) {

    const id = c.req.param("id");
    if (!id) throw new AppError(400, "缺少文章 ID");

    const body = await c.req.json();
    const updated = await postService.updatePost(c.env.DB, id, body);
    return c.json({ success: true, post: updated });
  }

  /**
   * [PUT] /pin/:id - 置頂文章
   */
  async pinPost(c: Context<AppContext>) {

    const id = c.req.param("id");
    if (!id) throw new AppError(400, "格式錯誤");
    const updated = await postService.pinPost(c.env.DB, id);
    return c.json({ success: true, post: updated });
  }

  /**
   * [PUT] /pin/reset - 重置所有文章的置頂狀態
   */
  async resetPinOrder(c: Context<AppContext>) {
    const updated = await postService.resetPinOrder(c.env.DB);
    return c.json({ success: true, post: updated });
  }

  /**
   * [DELETE] /:id - 刪除文章
   */
  async deletePost(c: Context<AppContext>) {

    const id = c.req.param("id");
    if (!id) throw new AppError(400, "缺少文章 ID");

    await postService.deletePost(c.env.DB, id);
    return c.json({ success: true, message: "文章刪除成功" });

  }
}

export const postController = new PostController();
