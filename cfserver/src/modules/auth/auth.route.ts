/**
 * ==============================================================================
 * 認證模組 - 路由定義 (Auth Route)
 * ==============================================================================
 * 路由清單：
 * - POST /login    : 管理員登入以換取 JWT Token (公開)
 * - GET  /profile  : 取得當前已登入之管理員資訊 (需認證)
 * - PUT  /profile  : 更新管理員暱稱 (需認證)
 */

import { Hono } from "hono";
import type { AppContext } from "../../types/env";
import { authController } from "./auth.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

const authRoute = new Hono<AppContext>();

// 1. [公開端點] 管理員登入
authRoute.post("/login", (c) => authController.login(c));

// 2. [受保護端點] 取得個人資料
authRoute.get("/profile", requireAuth, (c) => authController.getProfile(c));

// 3. [受保護端點] 修改個人暱稱
authRoute.put("/profile", requireAuth, (c) => authController.updateProfile(c));

// 4. [公開端點] 建立首位管理員帳號
authRoute.post("/signup", (c) => authController.signup(c));

export default authRoute;
