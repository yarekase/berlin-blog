// src/utils/api.ts
import axios from "axios";

// 1. 建立實例
const api = axios.create({
  baseURL: import.meta.env.PUBLIC_API_URL || "/api", 
  headers: {
    "Content-Type": "application/json",
  },
});

// 2. 設定「請求攔截器」：發送前自動加上 Token
api.interceptors.request.use((config) => {
  // 從 cookie 讀取 adminToken（伺服器端用 cookie 做認證，不是 localStorage）
  const token = document.cookie
    .split("; ")
    .find((row) => row.startsWith("adminToken="))
    ?.split("=")[1];

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// 3. 設定「回應攔截器」：統一處理錯誤（例如 Token 過期）
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config.url.includes("/login");
    // 如果後端回傳 401，代表 Token 無效或沒登入
    if (error.response && error.response.status === 401 && !isLoginRequest) {
      alert("登入逾時或權限不足，請重新登入");
      localStorage.removeItem("adminToken"); // 清除無效 Token
      window.location.href = "/admin/login"; // 強制導回登入頁[cite: 4]
    }
    return Promise.reject(error);
  }
);

export default api;