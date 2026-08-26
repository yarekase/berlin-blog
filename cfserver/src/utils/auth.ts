import { sign, verify } from "hono/jwt";

/**
 * 認證管理工具
 */

interface Admin {
  id: number;
  email: string;
  password_hash: string;
  nickname: string;
  created_at: string;
}

export interface AdminPayload {
  sub: string;    // 使用者 ID
  email: string;  // 使用者信箱
  exp: number;    // 過期時間
  iat: number;    // 簽發時間
}

export class AuthManager {
  async hashPassword(password: string, secret: string): Promise<string> {
    const encoderedDate = new TextEncoder().encode(password + secret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoderedDate);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async generateJWT(user: { id: number, email: string }, secret: string): Promise<string> {
    const payload = {
      sub: String(user.id),
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 天過期，匹配 Astro token 設定
      iat: Math.floor(Date.now() / 1000),
    };
    return await sign(payload, secret, "HS256");
  }

  async verifyLogin(DB: D1Database, email: string, password: string, secret: string): Promise<{ id: number; nickname: string, token: "authenticated" } | null> {
    const admin = await DB.prepare("SELECT * FROM admins WHERE email = ?")
      .bind(email)
      .first<Admin>();

    if (!admin) return null;

    const inputHash = await this.hashPassword(password, secret);
    console.log("Input Hash:", inputHash);

    if (inputHash === admin.password_hash) {
      return { id: admin.id, nickname: admin.nickname, token: "authenticated" };
    }
    return null;
  }

  /**
   * 驗證 JWT Token
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
    } catch (e) {
      return null;
    }
  }

  async getAdminProfile(DB: D1Database, adminId: number): Promise<{ id: number; email: string; nickname: string } | null> {
    const admin = await DB.prepare("SELECT id, email, nickname FROM admins WHERE id = ?")
      .bind(Number(adminId))
      .first<{ id: number; email: string; nickname: string }>();
    return admin || null;
  }

  async updateAdminNickname(DB: D1Database, adminId: string | number, newNickname: string): Promise<void> {
    await DB.prepare("UPDATE admins SET nickname = ? WHERE id = ?")
      .bind(newNickname, Number(adminId))
      .run();
  }
}

export const authManager = new AuthManager();
