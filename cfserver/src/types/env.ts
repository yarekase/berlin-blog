/**
 * ==============================================================================
 * 全域環境與 Context 型別定義 (Global Environment Types)
 * ==============================================================================
 * 定義 Cloudflare Workers Bindings (D1, R2, 環境變數) 以及 Hono Context 變數
 */

/** Cloudflare Workers 綁定的環境變數與資源 */
export interface Env {
  DB: D1Database;          // Cloudflare D1 SQLite 資料庫實例
  MY_BUCKET: R2Bucket;     // Cloudflare R2 儲存桶實例
  JWT_SECRET: string;      // JWT 簽發密鑰
  ADMIN_EMAIL?: string;    // 預設管理員信箱 (可選)
  ADMIN_PASSWORD?: string; // 預設管理員密碼 (可選)
  R2_PUBLIC_DOMAIN: string;// R2 公開訪問網域名稱
}

/** 解析 JWT 後存放在 Context 中的管理員資訊 */
export interface AdminPayload {
  sub: string;             // 管理員 ID (資料庫主鍵)
  email: string;           // 管理員信箱
  exp: number;             // Token 過期時間戳記
  iat: number;             // Token 簽發時間戳記
}

/** Hono 泛型 Context：提供給所有 Router 與 Controller 使用 */
export type AppContext = {
  Bindings: Env;
  Variables: {
    admin: AdminPayload;   // 通過驗證後由 Auth 中間件注入
  };
};
