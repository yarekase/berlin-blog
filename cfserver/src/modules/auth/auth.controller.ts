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
import { AppError } from "../../utils/appError";
import { validPassword } from "../../utils/validPassword";

export class AuthController {
  /**
   * [POST] /login - 管理員登入
   */
  async login(c: Context<AppContext>) {

    console.log("進入login")
    const { email, password } = await c.req.json();

    // 1. 參數驗證
    if (!email || !password || typeof password !== "string" || typeof email !== "string") {
      throw new AppError(400, "請輸入正確的帳號與密碼");
    }

    if (!validPassword(password).isValid) {
      throw new AppError(400, validPassword(password).message || "密碼格式錯誤");
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
  }

  /**
   * [GET] /profile - 取得目前登入者個人資訊
   */
  async getProfile(c: Context<AppContext>) {
    const adminPayload = c.get("admin");
    const admin = await authService.getProfile(c.env.DB, Number(adminPayload.sub));

    if (!admin) {
      return c.json({ error: "管理員帳號不存在" }, 404);
    }

    return c.json(admin);
  }

  /**
   * [PUT] /profile - 更新管理員暱稱
   */
  async updateProfile(c: Context<AppContext>) {

    const adminPayload = c.get("admin");
    const adminId = Number(adminPayload.sub);
    const { nickname } = await c.req.json();

    if (typeof nickname !== "string" || !nickname.trim()) {
      throw new AppError(400, "暱稱格式錯誤");
    }

    await authService.updateNickname(c.env.DB, adminId, nickname.trim());
    return c.json({ success: true, nickname });

  }

  /**
   * [PUT] /signup - 建立首位管理員帳號（僅限首次建立）
   */
  async signup(c: Context<AppContext>) {

    const { email, password, nickname } = await c.req.json();

    // 1. 參數格式驗證
    if (
      typeof email !== "string" || typeof password !== "string" || typeof nickname !== "string" ||
      !email.trim() || !password.trim() || !nickname.trim()
    ) {
      throw new AppError(400, "請輸入正確的帳號、密碼與暱稱");
    }

    // 2. 密碼格式驗證
    if (!validPassword(password).isValid) {
      throw new AppError(400, validPassword(password).message || "密碼格式錯誤");
    }

    // 3. 建立管理員
    const result = await authService.signup(
      c.env.DB,
      email.trim(),
      password,
      nickname.trim(),
      c.env.JWT_SECRET
    );

    return c.json({ success: true, user: result }, 201);

  }
}

export const authController = new AuthController();
