// src/pages/api/posts/[id].ts

import type { APIRoute } from "astro";


// ============================================================
// Types
// ============================================================

interface PostRow {
  id: string;
  title: string;
  author_name: string;
  slug: string;
  content: string | null;
  summary: string | null;
  status: "draft" | "published";
  preview_token: string;
  created_at: string;
  published_at: string | null;
  updated_at: string;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

interface ImageRow {
  webp_url: string;
}

interface UpdatePostBody {
  title?: string;
  author_name?: string;
  slug?: string;
  content?: string | null;
  summary?: string | null;
  status?: "draft" | "published";
  published_at?: string | null;
  category_ids?: number[];
}


// ============================================================
// GET /api/posts/:id
// 取得單篇文章
// ============================================================

export const GET: APIRoute = async ({ params, locals }) => {
  const DB = locals.runtime.env.DB;

  const postId = params.id;

  if (!postId) {
    return new Response(
      JSON.stringify({
        error: "缺少文章 ID",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    // --------------------------------------------------------
    // 1. 取得文章
    // --------------------------------------------------------

    const post = await DB.prepare(`
      SELECT
        id,
        title,
        author_name,
        slug,
        content,
        summary,
        status,
        preview_token,
        created_at,
        published_at,
        updated_at
      FROM posts
      WHERE id = ?
      LIMIT 1
    `)
      .bind(postId)
      .first<PostRow>();


    // --------------------------------------------------------
    // 2. 找不到文章
    // --------------------------------------------------------

    if (!post) {
      return new Response(
        JSON.stringify({
          error: "找不到文章",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }


    // --------------------------------------------------------
    // 3. 取得分類
    // --------------------------------------------------------

    const { results: categories } = await DB.prepare(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.sort_order
      FROM posts_categories pc
      INNER JOIN categories c
        ON pc.category_id = c.id
      WHERE pc.post_id = ?
      ORDER BY c.sort_order ASC, c.id ASC
    `)
      .bind(postId)
      .all<CategoryRow>();


    // --------------------------------------------------------
    // 4. 取得封面圖片
    // --------------------------------------------------------

    const coverImage = await DB.prepare(`
      SELECT
        webp_url
      FROM images
      WHERE post_id = ?
        AND is_cover = TRUE
      LIMIT 1
    `)
      .bind(postId)
      .first<ImageRow>();


    // --------------------------------------------------------
    // 5. 組合 API Response
    // --------------------------------------------------------

    const result = {
      ...post,
      categories,
      cover_image: coverImage?.webp_url ?? null,
    };


    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("GET /api/posts/:id error:", error);

    return new Response(
      JSON.stringify({
        error: "取得文章失敗",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};


// ============================================================
// PATCH /api/posts/:id
// 修改文章
// ============================================================

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const DB = locals.runtime.env.DB;

  const postId = params.id;

  if (!postId) {
    return new Response(
      JSON.stringify({
        error: "缺少文章 ID",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    // --------------------------------------------------------
    // 1. 解析 Request Body
    // --------------------------------------------------------

    const body = await request.json() as UpdatePostBody;

    const {
      title,
      author_name,
      slug,
      content,
      summary,
      status,
      published_at,
      category_ids,
    } = body;


    // --------------------------------------------------------
    // 2. 確認文章存在
    // --------------------------------------------------------

    const existingPost = await DB.prepare(`
      SELECT
        id,
        status,
        published_at
      FROM posts
      WHERE id = ?
      LIMIT 1
    `)
      .bind(postId)
      .first<{
        id: string;
        status: "draft" | "published";
        published_at: string | null;
      }>();


    if (!existingPost) {
      return new Response(
        JSON.stringify({
          error: "找不到文章",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }


    // --------------------------------------------------------
    // 3. 驗證 status
    // --------------------------------------------------------

    if (
      status !== undefined &&
      status !== "draft" &&
      status !== "published"
    ) {
      return new Response(
        JSON.stringify({
          error: "status 必須是 draft 或 published",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }


    // --------------------------------------------------------
    // 4. 建立 UPDATE 欄位
    // --------------------------------------------------------

    const updates: string[] = [];
    const values: unknown[] = [];


    if (title !== undefined) {
      updates.push("title = ?");
      values.push(title.trim() || "未命名草稿");
    }


    if (author_name !== undefined) {
      if (!author_name.trim()) {
        return new Response(
          JSON.stringify({
            error: "作者名稱不可為空",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }

      updates.push("author_name = ?");
      values.push(author_name.trim());
    }


    if (slug !== undefined) {
      if (!slug.trim()) {
        return new Response(
          JSON.stringify({
            error: "slug 不可為空",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }

      updates.push("slug = ?");
      values.push(slug.trim());
    }


    if (content !== undefined) {
      updates.push("content = ?");
      values.push(content);
    }


    if (summary !== undefined) {
      updates.push("summary = ?");
      values.push(summary);
    }


    // --------------------------------------------------------
    // 5. 處理 status / published_at
    // --------------------------------------------------------

    if (status !== undefined) {
      updates.push("status = ?");
      values.push(status);

      if (status === "published") {
        const publishedAt =
          published_at?.trim() ||
          existingPost.published_at ||
          new Date().toISOString();

        updates.push("published_at = ?");
        values.push(publishedAt);
      }

      if (status === "draft") {
        updates.push("published_at = ?");
        values.push(null);
      }

    } else if (published_at !== undefined) {
      updates.push("published_at = ?");
      values.push(published_at);
    }


    // --------------------------------------------------------
    // 6. 更新文章
    // --------------------------------------------------------

    if (updates.length > 0) {
      values.push(postId);

      await DB.prepare(`
        UPDATE posts
        SET
          ${updates.join(", ")},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .bind(...values)
        .run();
    }


    // --------------------------------------------------------
    // 7. 更新分類
    // --------------------------------------------------------

    if (category_ids !== undefined) {

      const categoryIds = [
        ...new Set(
          category_ids
            .map(Number)
            .filter(
              (id) =>
                Number.isInteger(id) &&
                id > 0
            )
        ),
      ];


      // 先刪除舊關聯
      await DB.prepare(`
        DELETE FROM posts_categories
        WHERE post_id = ?
      `)
        .bind(postId)
        .run();


      // 再建立新的關聯
      if (categoryIds.length > 0) {
        const statements = categoryIds.map((categoryId) =>
          DB.prepare(`
            INSERT INTO posts_categories (
              post_id,
              category_id
            )
            VALUES (?, ?)
          `)
            .bind(postId, categoryId)
        );

        await DB.batch(statements);
      }
    }


    // --------------------------------------------------------
    // 8. 取得更新後的文章
    // --------------------------------------------------------

    const updatedPost = await DB.prepare(`
      SELECT
        id,
        title,
        author_name,
        slug,
        content,
        summary,
        status,
        preview_token,
        created_at,
        published_at,
        updated_at
      FROM posts
      WHERE id = ?
      LIMIT 1
    `)
      .bind(postId)
      .first<PostRow>();


    return new Response(
      JSON.stringify({
        success: true,
        post: updatedPost,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("PATCH /api/posts/:id error:", error);

    return new Response(
      JSON.stringify({
        error: "更新文章失敗",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};


// ============================================================
// DELETE /api/posts/:id
// 刪除文章
// ============================================================

export const DELETE: APIRoute = async ({ params, locals }) => {
  const DB = locals.runtime.env.DB;

  const postId = params.id;

  if (!postId) {
    return new Response(
      JSON.stringify({
        error: "缺少文章 ID",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    // --------------------------------------------------------
    // 1. 確認文章存在
    // --------------------------------------------------------

    const post = await DB.prepare(`
      SELECT id
      FROM posts
      WHERE id = ?
      LIMIT 1
    `)
      .bind(postId)
      .first<{ id: string }>();


    if (!post) {
      return new Response(
        JSON.stringify({
          error: "找不到文章",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }


    // --------------------------------------------------------
    // 2. 刪除文章
    //
    // posts_categories / images
    // 依照資料庫 ON DELETE CASCADE
    // 自動刪除
    // --------------------------------------------------------

    await DB.prepare(`
      DELETE FROM posts
      WHERE id = ?
    `)
      .bind(postId)
      .run();


    return new Response(
      JSON.stringify({
        success: true,
        id: postId,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("DELETE /api/posts/:id error:", error);

    return new Response(
      JSON.stringify({
        error: "刪除文章失敗",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};