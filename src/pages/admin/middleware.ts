import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  const { url, cookies, redirect } = context;

  // 檢查是否為管理後台路徑，且排除登入頁面本身，避免無限重導向
  if (url.pathname.startsWith("/admin") && url.pathname !== "/admin/login") {
    const adminToken = cookies.get("adminToken");

    // 如果沒有 Token，直接導向登入頁面
    if (!adminToken) {
      return redirect("/admin/login");
    }
  }

  // 繼續執行原本的請求
  return next();
});