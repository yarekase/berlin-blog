// src/utils/api.ts
import axios from "axios";

// 1. 建立實例
const api = axios.create({
  // 因為你的 Hono 定義在 src/pages/admin/posts.ts，所以 base 是 /admin/posts
  baseURL: "/api/posts", 
  headers: {
    "Content-Type": "application/json",
  },
});

// 2. 設定「請求攔截器」：發送前自動加上 Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken"); // 取得登入時存入的字串[cite: 1, 4]
  
  if (token) {
    // 依照你在 post.ts 寫的中間件邏輯，這裡要對齊 "Bearer authenticated"
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
    // 如果後端回傳 401，代表 Token 無效或沒登入
    if (error.response && error.response.status === 401) {
      alert("登入逾時或權限不足，請重新登入");
      localStorage.removeItem("adminToken"); // 清除無效 Token
      window.location.href = "/admin/login"; // 強制導回登入頁[cite: 4]
    }
    return Promise.reject(error);
  }
);

export default api;