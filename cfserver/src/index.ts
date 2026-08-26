import { Hono } from "hono";
import { cors } from "hono/cors";
import { postManager, type Category } from "./utils/postManager";
import { authManager, type AdminPayload } from "./utils/auth";

export interface Env {
  DB: D1Database;
  MY_BUCKET: R2Bucket;
  JWT_SECRET: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  R2_PUBLIC_DOMAIN: string;
}

const app = new Hono<{ Bindings: Env, Variables: { admin: AdminPayload } }>().basePath("/api");

// ==========================================
// [CORS 中間件] 處理跨來源請求
// ==========================================
app.use("*", cors({
  origin: (origin) => {
    // 允許所有來源進行連接（包括本地 localhost 與 production Pages 網域）
    return origin || "*";
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
}));

app.get("/test", (c) => c.text("Hono is working on Cloudflare Workers!"));

app.get("/test-db", async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM posts").all();
    return c.json({
      success: true,
      meta: { engine: "D1 (Worker Backend)" },
      count: results.length,
      data: results,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==========================================
// [驗證中間件] 檢查管理員身分
// ==========================================
app.use("*", async (c, next) => {
  // 放行登入與公開的 API，不需驗證
  if (c.req.path === "/api/login" && c.req.method === "POST") {
    return await next();
  }
  // 僅針對寫入操作 (POST, PUT, DELETE) 與管理員專屬 GET 路由進行攔截
  if (
    ["POST", "PUT", "DELETE"].includes(c.req.method) || 
    c.req.path === "/api/profile"
  ) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "未經授權：請先登入管理員帳號" }, 401);
    }
    const token = authHeader.split(" ")[1];
    const payload = await authManager.verifyJWT(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ error: "授權過期或無效，請重新登入" }, 401);
    }
    c.set("admin", payload);
  }
  await next();
});

// ==========================================
// [GET] 獲取所有文章列表
// ==========================================
app.get("/posts", async (c) => {
  try {
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
    const adminPayload = c.get("admin");
    const admin = await authManager.getAdminProfile(c.env.DB, Number(adminPayload.sub));
    if (!admin) {
      return c.json({ error: "管理員不存在" }, 404);
    }
    return c.json(admin);
  } catch (error: any) {
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
      return c.json({ error: "請輸入帳號與密碼" }, 400);
    }
    const result = await authManager.verifyLogin(c.env.DB, email, password, c.env.JWT_SECRET);
    if (result) {
      const token = await authManager.generateJWT(
        { id: Number(result.id), email },
        c.env.JWT_SECRET
      );
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
    const { name } = await c.req.json();
    if (!name) return c.json({ error: "名稱為必填" }, 400);
    const newCategory = await postManager.createCategory(c.env.DB, name);
    return c.json(newCategory, 201);
  } catch (error: any) {
    if (error.message.includes("已存在")) {
      return c.json({ error: error.message }, 409);
    }
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// [GET] 獲取單篇文章詳情
// ==========================================
app.get("/posts/:id", async (c) => {
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
app.post("/posts", async (c) => {
  try {
    const body = await c.req.json();
    await postManager.addPost(c.env.DB, body);
    return c.json({ success: true }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// [PUT] 更新文章
// ==========================================
app.put("/posts/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
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
    const adminPayload = c.get("admin");
    const adminId = Number(adminPayload.sub);
    const { nickname } = await c.req.json();
    if (!nickname) return c.json({ error: "暱稱不能為空" }, 400);
    await authManager.updateAdminNickname(c.env.DB, adminId, nickname);
    return c.json({ success: true, nickname });
  } catch (error: any) {
    return c.json({ error: "更新失敗：伺服器錯誤" }, 500);
  }
});

// ==========================================
// [DELETE] 刪除文章
// ==========================================
app.delete("/posts/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "缺少文章 ID" }, 400);
    await postManager.deletePost(c.env.DB, id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// [上傳] 處理圖片上傳至 R2
// ==========================================
app.post("/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const originalFile = body["file"] as File;
    const webpFile = body["webp"] as File;

    if (!originalFile) {
      return c.json({ success: 0, message: "無上傳的檔案" }, 400);
    }

    const uuid = crypto.randomUUID();

    // 1. 儲存原始檔案
    const originalExt = originalFile.name.split(".").pop();
    const originalPath = `raw/${uuid}.${originalExt}`;
    await c.env.MY_BUCKET.put(originalPath, await originalFile.arrayBuffer(), {
      httpMetadata: { contentType: originalFile.type },
    });

    // 2. 儲存 WebP 檔案 (供網頁快速顯示)
    let webpPath = "";
    if (webpFile) {
      webpPath = `optimized/${uuid}.webp`;
      await c.env.MY_BUCKET.put(webpPath, await webpFile.arrayBuffer(), {
        httpMetadata: { contentType: "image/webp" },
      });
    }

    return c.json({ 
      success: 1, 
      file: {
        original_key: originalPath,
        original_url: `${c.env.R2_PUBLIC_DOMAIN}/${originalPath}`,
        webp_key: webpPath || null,
        webp_url: webpPath ? `${c.env.R2_PUBLIC_DOMAIN}/${webpPath}` : null
      }
    });
  } catch (error: any) {
    return c.json({ success: 0, message: error.message }, 500);
  }
});

export default app;
