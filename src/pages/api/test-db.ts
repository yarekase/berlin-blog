import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

/**
 * 測試 D1 資料庫連線的 API
 * 路徑：http://127.0.0.1:8787/api/test-db
 */
export const GET: APIRoute = async () => {
  // 在 Astro 6 中，這是獲取 Cloudflare 綁定最穩定的方式
  const db = (env as any).DB;

  if (!db) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "找不到資料庫綁定。請檢查 wrangler.toml 的 binding 是否為 'DB'。",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 執行查詢
    const { results } = await db.prepare("SELECT * FROM posts").all();
    
    // 獲取資料庫資訊以驗證連線類型
    const dbVersion = await db.prepare("PRAGMA user_version").first();

    return new Response(
      JSON.stringify({
        success: true,
        meta: {
          engine: "D1",
          user_version: dbVersion,
        },
        count: results.length,
        data: results,
      }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "未知查詢錯誤",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};