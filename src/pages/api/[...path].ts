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
import { authManager, type AdminPayload} from "../../utils/auth";
import type { Env } from "../../env";
import { env } from "cloudflare:workers";

const app = new Hono<{ Bindings: Env, Variables: { admin: AdminPayload } }>().basePath('/api');

app.get("/test", (c) => c.text("Hono is working!"));

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
    const token = authHeader.split(" ")[1];
    const payload = await authManager.verifyJWT(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ error: "授權過期或無效，請重新登入" }, 401);
    }

    // 3. (進階) 把使用者資訊存入 c.set，後面的路由就能直接拿到 id
    c.set("admin", payload);
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
// [GET] 獲取個人暱稱
// ==========================================
app.get("/profile", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return c.json({ error: "未提供認證憑證，請先登入" }, 401);
    }

    // 驗證 JWT
    const payload = await authManager.verifyJWT(token, c.env.JWT_SECRET);

    if (!payload) {
      return c.json({ error: "憑證無效或已過期，請重新登入" }, 401);
    }

    // 查詢資料庫
    const admin = await c.env.DB.prepare("SELECT nickname, email FROM admins WHERE id = ?")
      .bind(payload.sub)
      .first();

    if (!admin) {
      return c.json({ error: "找不到該管理員帳號" }, 404);
    }

    return c.json(admin);

  } catch (error) {
    // 這裡會攔截所有非預期的報錯（例如資料庫斷線、程式碼邏輯噴錯等）
    console.error("Profile API Error:", error); 
    return c.json({ error: "伺服器內部錯誤，請稍後再試" }, 500);
  }
});

// ==========================================
// [POST] 管理員登入
// ==========================================
app.post("/login", async (c) => {
  try {
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: "請輸入帳號與密碼" }, 400); // 400 代表請求格式錯誤
  }
  const result = await authManager.verifyLogin(c.env.DB, email, password,c.env.JWT_SECRET);
  if (result) {
    const token = await authManager.generateJWT(
      { id: Number(result.id), email },
      c.env.JWT_SECRET);
    return c.json({ success: true, token, nickname: result.nickname });
  }
  return c.json({ error: "登入失敗：帳號或密碼錯誤" }, 400);
} catch (error: any) {
  return c.json({ error: "登入失敗：伺服器錯誤" }, 500);
}
});

// ==========================================
// [POST] 新增分類
// ==========================================

app.post("/categories", async (c) => {
  try {
    const { name } = await c.req.json(); // 接收前端 axios.post 傳來的資料
    
    if (!name) return c.json({ error: "名稱為必填" }, 400);

    // 呼叫 postManager 裡面的邏輯 (等等我們要去補寫這個 method)
    const newCategory = await postManager.createCategory(c.env.DB, name);
    
    return c.json(newCategory, 201); // 成功建立回傳 201
  } catch (error: any) {
    // 檢查是否為重複資料導致的錯誤
    if (error.message.includes("已存在")) {
      return c.json({ error: error.message }, 409);
    }
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
// [PUT] 更新使用者暱稱
// ==========================================
app.put("/profile", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return c.json({ error: "未提供認證憑證，請先登入" }, 401);
    }
    const payload = await authManager.verifyJWT(token, c.env.JWT_SECRET);

    if (!payload) {
      return c.json({ error: "憑證無效或已過期，請重新登入" }, 401);
    }

    const adminId = payload.sub; // 這是你在 generateJWT 時放進去的 user.id

    const { nickname } = await c.req.json();

    if (!nickname) return c.json({ error: "暱稱不能為空" }, 400);

    try {
      // 2. 更新資料庫
      await c.env.DB.prepare("UPDATE admins SET nickname = ? WHERE id = ?")
        .bind(nickname, adminId)
        .run();

      return c.json({ success: true, nickname });
    } catch (e) {
      return c.json({ error: "更新失敗" }, 500);
    }
  } catch (error: any) {
    return c.json({ error: "更新失敗：伺服器錯誤" }, 500);
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
    const originalFile = body["file"] as File; // 原始檔
    const webpFile = body["webp"] as File;     // WebP 檔

    const uuid = crypto.randomUUID();

    // 1. 儲存原始檔案 (供未來下載使用)
    const originalExt = originalFile.name.split(".").pop();
    const originalPath = `raw/${uuid}.${originalExt}`;
    await c.env.MY_BUCKET.put(originalPath, await originalFile.arrayBuffer(), {
      httpMetadata: { contentType: originalFile.type },
    });

    // 2. 儲存 WebP 檔案 (供網頁快速顯示)
    let publicUrl = "";
    if (webpFile) {
      const webpPath = `optimized/${uuid}.webp`;
      await c.env.MY_BUCKET.put(webpPath, await webpFile.arrayBuffer(), {
        httpMetadata: { contentType: "image/webp" },
      });
      // 最終給 Editor.js 的網址使用 WebP 檔案
      publicUrl = `${c.env.R2_PUBLIC_DOMAIN}/${webpPath}`;
    } else {
      // 如果沒提供 WebP，就退而求其次用原始檔網址
      publicUrl = `${c.env.R2_PUBLIC_DOMAIN}/${originalPath}`;
    }

    return c.json({ success: 1, file: { url: publicUrl } });
  } catch (error: any) {
    return c.json({ success: 0, message: error.message }, 500);
  }
});

/**
 * 將 Hono 實例橋接到 Astro 的 API 路由
 * ALL 會攔截所有請求並交由 Hono 的內部路由處理
 */
export const ALL: APIRoute = async (context) => {
  // 在 Astro Cloudflare Adapter 中，Bindings 儲存在 context.locals.runtime.env
  // 我們必須將這個 env 傳遞給 Hono，這樣 c.env.DB 才有值
  return app.fetch(context.request, env);
};
