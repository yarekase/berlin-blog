/**
 * ==============================================================================
 * 認證中間件 (Authentication Middleware)
 * ==============================================================================
 * 職責：
 * 1. 攔截需要管理員權限的請求 (POST, PUT, DELETE 或特定管理端點)。
 * 2. 檢查請求標頭 Authorization: Bearer <Token>。
 * 3. 驗證 JWT Token 有效性與過期時間。
 * 4. 將解析後的管理員資訊注入 c.set("admin", payload)，供後續 Controller 使用。
 */

import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { AppContext, AdminPayload } from "../types/env";

export const requireAuth = createMiddleware<AppContext>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  // 1. 檢查是否存在 Bearer Token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "未經授權：請先登入管理員帳號" }, 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    // 2. 驗證 Token 簽名與效期
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");

    if (!payload || !payload.sub) {
      return c.json({ error: "授權過期或無效，請重新登入" }, 401);
    }

    // 3. 將管理員資訊存入 Context Variable
    c.set("admin", {
      sub: String(payload.sub),
      email: payload.email as string,
      exp: payload.exp as number,
      iat: payload.iat as number,
    });

    await next();
  } catch (error) {
    return c.json({ error: "Token 解析失敗或已過期，請重新登入" }, 401);
  }
});
