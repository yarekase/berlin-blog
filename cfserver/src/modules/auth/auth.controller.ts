/**
 * ==============================================================================
 * 認證模組 - 控制器 (Auth Controller)
 * ==============================================================================
 * 職責：
 * 1. 接收 HTTP 請求並進行參數驗證。
 * 2. 呼叫 authService 處理登入與資訊更新邏輯。
 * 3. 回傳標準化 JSON 回應與適當的 HTTP 狀態碼。
 */

import type { Context } from "hono";
import type { AppContext } from "../../types/env";
import { authService } from "./auth.service";

export class AuthController {
  /**
   * [POST] /login - 管理員登入
   */
  async login(c: Context<AppContext>) {
    try {
      console.log("進入login")
      const { email, password } = await c.req.json();

      // 1. 參數驗證
      if (!email || !password) {
        return c.json({ error: "請輸入帳號與密碼" }, 400);
      }

      // 2. 驗證身分 (支援資料庫查詢與 .dev.vars 預設帳號初始化)
      const result = await authService.verifyLogin(
        c.env.DB,
        email.trim(),
        password,
        c.env.JWT_SECRET,
        c.env.ADMIN_EMAIL,
        c.env.ADMIN_PASSWORD
      );

      if (!result) {
        return c.json({ error: "登入失敗：帳號或密碼錯誤" }, 400);
      }

      // 3. 簽發 Token
      const token = await authService.generateJWT(
        { id: Number(result.id), email },
        c.env.JWT_SECRET
      );

      return c.json({
        success: true,
        token,
        nickname: result.nickname,
      });
    } catch (error: any) {
      console.error("[AuthController.login Error]:", error);
      return c.json({ error: "伺服器內部錯誤，請稍後再試" }, 500);
    }
  }

  /**
   * [GET] /profile - 取得目前登入者個人資訊
   */
  async getProfile(c: Context<AppContext>) {
    try {
      const adminPayload = c.get("admin");
      const admin = await authService.getProfile(c.env.DB, Number(adminPayload.sub));

      if (!admin) {
        return c.json({ error: "管理員帳號不存在" }, 404);
      }

      return c.json(admin);
    } catch (error: any) {
      console.error("[AuthController.getProfile Error]:", error);
      return c.json({ error: "伺服器內部錯誤，請稍後再試" }, 500);
    }
  }

  /**
   * [PUT] /profile - 更新管理員暱稱
   */
  async updateProfile(c: Context<AppContext>) {
    try {
      const adminPayload = c.get("admin");
      const adminId = Number(adminPayload.sub);
      const { nickname } = await c.req.json();

      if (!nickname || typeof nickname !== "string" || !nickname.trim()) {
        return c.json({ error: "暱稱不能為空" }, 400);
      }

      await authService.updateNickname(c.env.DB, adminId, nickname.trim());
      return c.json({ success: true, nickname: nickname.trim() });
    } catch (error: any) {
      console.error("[AuthController.updateProfile Error]:", error);
      return c.json({ error: "更新暱稱失敗：伺服器錯誤" }, 500);
    }
  }

  /**
   * [PUT] /signup - 建立首位管理員帳號（僅限首次建立）
   */
  async signup(c: Context<AppContext>) {
    try {
      const { email, password, nickname } = await c.req.json();

      if (!email || !password || !nickname) {
        return c.json({ error: "請輸入帳號、密碼與暱稱" }, 400);
      }

      const result = await authService.signup(
        c.env.DB,
        email.trim(),
        password,
        nickname.trim(),
        c.env.JWT_SECRET
      );

      return c.json({ success: true, user: result });
    } catch (error: any) {
      console.error("[AuthController.signup Error]:", error);
      return c.json({ error: "註冊失敗：伺服器錯誤" }, 500);
    }
  }
}

export const authController = new AuthController();
