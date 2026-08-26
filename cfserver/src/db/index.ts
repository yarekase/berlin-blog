import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * 根據 Cloudflare D1 實例動態初始化 Drizzle ORM
 * 
 * @param d1 D1Database 實例 (例如 c.env.DB)
 * @returns Drizzle ORM 資料庫實例
 */
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DbType = ReturnType<typeof getDb>;
