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
        error: "Cloudflare 環境中找不到 'DB' 綁定，請確認專案設定。",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 執行查詢
    const { results } = await db.prepare("SELECT * FROM posts").all();
    
   

    return new Response(
      JSON.stringify({
        success: true,
        meta: {
          engine: "D1",
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