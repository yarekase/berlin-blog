import {sign} from "hono/jwt";

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
  sub: number;    // 使用者 ID
  email: string;  // 使用者信箱
  exp: number;    // 過期時間
  iat: number;    // 簽發時間
}

/**
 * 使用SHA-256算法對密碼進行雜湊處理
 */
export class AuthManager {
  async hashPassword(password: string): Promise<string> {
    const encoderedDate = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoderedDate);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async generateJWT(user:{id:number, email:string}, secret: string): Promise<string> {
    const payload = {
      sub: user.id.toString(),
      email: user.email,
      exp: Math.floor(Date.now() / 1000) +60*60*24, // 24小時後過期
      iat: Math.floor(Date.now() / 1000),
    };
    return await sign(payload, secret, "HS256");
  }

  async verifyLogin(DB: D1Database, email: string, password: string): Promise<{ id: number; nickname: string, token:"authenticated" } | null> {
    const admin = await DB.prepare("SELECT * FROM admins WHERE email = ?")
    .bind(email)
    .first<Admin>();

    if (!admin) return null;

    const inputHash = await this.hashPassword(password);
    if (inputHash === admin.password_hash) {
      return { id: admin.id, nickname: admin.nickname, token: "authenticated" };
    }
    return null;
  }

  getNickname(): string {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nickname") || "管理員";
    }
    return "管理員";
  }

  setNickname(nickname: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("nickname", nickname);
    }
  }

  checkAuth() {
    if (typeof window !== "undefined" && !localStorage.getItem("adminToken")) {
      window.location.href = "/login";
    }
  }

  logout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminNickname");
    window.location.href = "/login";
  }

  async getAdminProfile(DB: D1Database, adminId: number): Promise<{ id: number; email: string; nickname: string } | null> {
    const admin = await DB.prepare("SELECT id, email, nickname FROM admins WHERE id = ?")
      .bind(adminId)
      .first<{ id: number; email: string; nickname: string }>();
    return admin || null;
  }

  async updateAdminNickname(DB: D1Database, adminId: number, newNickname: string): Promise<void> {
    await DB.prepare("UPDATE admins SET nickname = ? WHERE id = ?")
      .bind(newNickname, adminId)
      .run();
  }

}

export const authManager = new AuthManager();