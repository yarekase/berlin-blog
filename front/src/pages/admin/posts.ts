/**
 * 文章與分類的後端 API 路由
 *
 * 【為什麼需要這份檔案？】
 * 1. 路由語法更直觀：使用 .get(), .post() 等方法取代 switch/if 判斷。
 * 2. 簡化回應處理：自動處理 JSON 序列化與 Header 設定。
 * 3. 強大的型別支援：能完美繼承 Cloudflare 的環境變數定義。
 */

import { Hono } from "hono";
import type { APIRoute } from "astro";
import { postManager, type Category } from "../../utils/postManager";
import type { Env } from "../../env";

const app = new Hono<{ Bindings: Env }>();

// ==========================================
// [驗證中間件] 檢查管理員身分
// ==========================================
app.use("*", async (c, next) => {
  // 僅針對寫入操作 (POST, PUT, DELETE) 進行攔截
  if (["POST", "PUT", "DELETE"].includes(c.req.method)) {
    const authHeader = c.req.header("Authorization");
    // 檢查是否有 Bearer Token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "未經授權：請先登入管理員帳號" }, 401);
    }
  }
  await next();
});

// ==========================================
// [GET] 獲取所有文章列表
// ==========================================
app.get("/", async (c) => {
  try {
    // 僅回傳不含 content 的輕量化列表，節省 D1 讀取成本
    const posts = await postManager.getPostsList(c.env.DB);
    return c.json(posts);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// [GET] 獲取全部分類
// ==========================================
app.get("/categories", async (c) => {
  try {
    const categories = await postManager.getCategories(c.env.DB);
    return c.json(categories);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// [GET] 獲取單篇文章詳情
// ==========================================
app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const post = await postManager.getPost(c.env.DB, id);
    return post ? c.json(post) : c.json({ error: "文章不存在" }, 404);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// [POST] 新增文章
// ==========================================
app.post("/", async (c) => {
  try {
    const body = (await c.req.json()) as {
      title: string;
      author_name: string;
      content: string;
      cover_image: string;
      status: "draft" | "published";
      categories: Category[];
    };
    await postManager.addPost(c.env.DB, body);
    return c.json({ success: true }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// [PUT] 更新文章
// ==========================================
app.put("/", async (c) => {
  try {
    const { id, updates } = (await c.req.json()) as {
      id: string;
      updates: Partial<{
        title: string;
        author_name: string;
        content: string;
        summary: string;
        cover_image: string;
        status: "draft" | "published";
        categories: Category[];
      }>;
    };
    if (!id) return c.json({ error: "缺少 ID" }, 400);

    await postManager.updatePost(c.env.DB, id, updates);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// [DELETE] 刪除文章
// ==========================================
app.delete("/", async (c) => {
  try {
    const id = c.req.query("id");
    if (!id) return c.json({ error: "缺少 ID 參數" }, 400);

    await postManager.deletePost(c.env.DB, id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// [上傳] 處理圖片上傳至 R2
// ==========================================
/**
 * 作用：當 Editor.js 選擇圖片時觸發
 * 格式符合 Editor.js Image Tool 要求
 */
app.post("/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["image"] as File;

    if (!file) {
      return c.json({ success: 0, message: "找不到檔案" }, 400);
    }

    // 生成唯一檔名 (UUID + 原始副檔名)
    const extension = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${extension}`;
    const filePath = `uploads/${fileName}`;

    // 寫入 Cloudflare R2 Bucket
    await c.env.MY_BUCKET.put(filePath, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    // 回傳 Editor.js 期待的 JSON 格式
    // 注意：這裡的 URL 應該是你的 R2 公開訪問域名或 Worker 代理路徑
    const publicUrl = `https://your-r2-public-domain.com/${filePath}`;

    return c.json({
      success: 1,
      file: { url: publicUrl },
    });
  } catch (error: any) {
    console.error("圖片上傳失敗:", error);
    return c.json({ success: 0, message: error.message }, 500);
  }
});

/**
 * 將 Hono 實例橋接到 Astro 的 API 路由
 * ALL 會攔截所有請求並交由 Hono 的內部路由處理
 */
export const ALL: APIRoute = async (context) => {
  // 將 context.locals.env 直接傳給 Hono
  return app.fetch(context.request, context.locals.env);
};
