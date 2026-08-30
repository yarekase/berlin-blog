/**
 * ==============================================================================
 * 管理員認證服務模組 (Auth Service with Drizzle ORM)
 * ==============================================================================
 */
import { sign, verify } from "hono/jwt";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { admins } from "../db/schema";

export interface AdminPayload {
  sub: string;    // 管理員 ID
  email: string;  // 帳號信箱
  exp: number;    // Token 過期時間戳記
  iat: number;    // 簽發時間戳記
}

export class AuthManager {
  /**
   * 使用 SHA-256 + 密鑰計算雜湊密碼
   */
  async hashPassword(password: string, secret: string): Promise<string> {
    const encodedData = new TextEncoder().encode(password + secret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encodedData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * 簽發管理員 JWT Token (效期 7 天)
   */
  async generateJWT(user: { id: number; email: string }, secret: string): Promise<string> {
    const payload = {
      sub: String(user.id),
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 天
      iat: Math.floor(Date.now() / 1000),
    };
    return await sign(payload, secret, "HS256");
  }

  /**
   * 驗證管理員登入帳號密碼 (Drizzle 查詢)
   */
  async verifyLogin(
    DB: D1Database,
    email: string,
    password: string,
    secret: string
  ): Promise<{ id: number; nickname: string; token: "authenticated" } | null> {
    const db = getDb(DB);
    
    // 使用 Drizzle ORM 查詢管理員
    const admin = await db.query.admins.findFirst({
      where: eq(admins.email, email),
    });

    if (!admin) return null;

    const inputHash = await this.hashPassword(password, secret);
    if (inputHash === admin.passwordHash) {
      return { id: admin.id, nickname: admin.nickname, token: "authenticated" };
    }
    return null;
  }

  /**
   * 驗證傳入的 JWT Token
   */
  async verifyJWT(token: string, secret: string): Promise<AdminPayload | null> {
    try {
      const payload = await verify(token, secret, "HS256");
      return {
        sub: String(payload.sub),
        email: payload.email as string,
        exp: payload.exp as number,
        iat: payload.iat as number,
      };
    } catch {
      return null;
    }
  }

  /**
   * 取得管理員個人資料 (Drizzle 查詢)
   */
  async getAdminProfile(
    DB: D1Database,
    adminId: number
  ): Promise<{ id: number; email: string; nickname: string } | null> {
    const db = getDb(DB);
    const admin = await db.query.admins.findFirst({
      where: eq(admins.id, adminId),
      columns: {
        id: true,
        email: true,
        nickname: true,
      },
    });
    return admin || null;
  }

  /**
   * 更新管理員暱稱 (Drizzle UPDATE)
   */
  async updateAdminNickname(
    DB: D1Database,
    adminId: number,
    newNickname: string
  ): Promise<void> {
    const db = getDb(DB);
    await db
      .update(admins)
      .set({ nickname: newNickname })
      .where(eq(admins.id, adminId));
  }
}

export const authManager = new AuthManager();
