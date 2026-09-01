/**
 * ==============================================================================
 * 認證模組 - 資料服務層 (Auth Service)
 * ==============================================================================
 * 職責：
 * 1. 負責管理員資料的資料庫查詢 (Drizzle ORM)。
 * 2. 密碼雜湊運算 (SHA-256)。
 * 3. JWT 簽發。
 */

import { sign } from "hono/jwt";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { admins } from "../../db/schema";
import { AppError } from "../../utils/appError";

export class AuthService {
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
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      iat: Math.floor(Date.now() / 1000),
    };
    return await sign(payload, secret, "HS256");
  }

  /**
   * 驗證帳號與密碼是否正確 (支援資料庫比對與 .dev.vars 預設管理員自動初始化)
   */
  async verifyLogin(
    DB: D1Database,
    email: string,
    password: string,
    secret: string,
    envAdminEmail?: string,
    envAdminPassword?: string
  ): Promise<{ id: number; nickname: string } | null> {
    const db = getDb(DB);

    const admin = await db.query.admins.findFirst({
      where: eq(admins.email, email),
    });

    if (admin) {
      const inputHash = await this.hashPassword(password, secret);
      if (inputHash === admin.passwordHash) {
        return { id: admin.id, nickname: admin.nickname };
      }
      return null;
    }

    // 若資料庫尚未建立此帳號，但輸入之帳密與 .dev.vars 中的 ADMIN_EMAIL/ADMIN_PASSWORD 吻合，則自動初始化寫入資料庫
    if (envAdminEmail && envAdminPassword && email === envAdminEmail && password === envAdminPassword) {
      const passwordHash = await this.hashPassword(password, secret);
      const [seeded] = await db
        .insert(admins)
        .values({
          email,
          passwordHash,
          nickname: "系統管理員",
          createdAt: new Date().toISOString(),
        })
        .returning();

      return { id: seeded.id, nickname: seeded.nickname };
    }

    return null;
  }

  /**
   * 取得管理員個人資料
   */
  async getProfile(DB: D1Database, adminId: number) {
    const db = getDb(DB);
    return await db.query.admins.findFirst({
      where: eq(admins.id, adminId),
      columns: {
        id: true,
        email: true,
        nickname: true,
        createdAt: true,
      },
    });
  }

  /**
   * 更新管理員暱稱
   */
  async updateNickname(DB: D1Database, adminId: number, nickname: string) {
    const db = getDb(DB);

    if (!nickname || nickname.trim() === "") {
      throw new AppError(400, "暱稱不能為空");
    }

    if (nickname.trim().length > 10) {
      throw new AppError(400, "暱稱長度不能超過10個字");
    }

    await db.update(admins).set({ nickname: nickname.trim() }).where(eq(admins.id, adminId));

    return { id: adminId, nickname: nickname.trim() };
  }

  /**
   * 建立首位管理員帳號
   */
  async signup(DB: D1Database, email: string, password: string, nickname: string, secret: string) {
    const db = getDb(DB);

    // 檢查是否已存在管理員
    const existingAdmin = await db.query.admins.findFirst();
    if (existingAdmin) {
      throw new AppError(400, "系統已有管理員帳號，無法重複註冊");
    }

    // 雜湊密碼
    const hashedPassword = await this.hashPassword(password, secret);
    const now = new Date().toISOString();

    // 建立新管理員
    const [newAdmin] = await db
      .insert(admins)
      .values({
        email,
        passwordHash: hashedPassword,
        nickname,
        createdAt: now
      })
      .returning();

    return {
      id: newAdmin.id,
      email: newAdmin.email,
      nickname: newAdmin.nickname,
      createdAt: newAdmin.createdAt,
    };
  }
}

export const authService = new AuthService();
