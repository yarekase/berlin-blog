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
  sub: number;    // 使用者 ID
  email: string;  // 使用者信箱
  exp: number;    // 過期時間
  iat: number;    // 簽發時間
}

/**
 * 使用SHA-256算法對密碼進行雜湊處理
 */
export class AuthManager {
  async hashPassword(password: string,secret: string): Promise<string> {
    const encoderedDate = new TextEncoder().encode(password+secret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoderedDate);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async generateJWT(user:{id:number, email:string}, secret: string): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) +60*60*24, // 24小時後過期
      iat: Math.floor(Date.now() / 1000),
    };
    return await sign(payload, secret, "HS256");
  }

  async verifyLogin(DB: D1Database, email: string, password: string, secret: string): Promise<{ id: number; nickname: string, token:"authenticated" } | null> {
    const admin = await DB.prepare("SELECT * FROM admins WHERE email = ?")
    .bind(email)
    .first<Admin>();

    if (!admin) return null;

    const inputHash = await this.hashPassword(password, secret);

    if (inputHash === admin.password_hash) {
      return { id: admin.id, nickname: admin.nickname, token: "authenticated" };
    }
    return null;
  }


  /**
   * 驗證 JWT Token
   * @param token 
   * @param secret "JWT Secret Key"
   * @returns "sub"、"email"、"exp"、"iat" 等資訊的物件，或是驗證失敗回傳 null
   */
  async verifyJWT(token: string, secret: string): Promise<AdminPayload | null> {
  try {
    // 使用 secret 進行解碼與驗證
    const payload = await verify(token, secret, "HS256");
    return {
      sub: Number(payload.sub),
      email: payload.email as string,
      exp: payload.exp as number,
      iat: payload.iat as number,
    };
  } catch (e) {
    // 如果 Token 過期、格式錯誤或是 Secret 不對，會拋出錯誤
    return null;
  }
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