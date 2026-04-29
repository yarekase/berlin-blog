/**
 * 【頁面協調中心】
 * 負責處理儀表板的全域邏輯，例如身份驗證、登出、以及將請求「分發」給對應的模態框。
 */
import axios from "axios";
import { checkAuth, logout, setNickname, getNickname } from "../utils/auth";

/**
 * DOM 輔助函數
 */
function $<T>(id: string, required = true): T {
  const el = document.getElementById(id);
  if (!el && required) throw new Error(`Necessary DOM element #${id} missing.`);
  return el as unknown as T;
}

export function initDashboard() {
  checkAuth();

  const settingsModal = $<HTMLDivElement>("settingsModal");
  const newPostBtn = document.getElementById("newPostBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const settingsForm = document.getElementById("settingsForm") as HTMLFormElement;

  // --- 1. 文章列表動作監聽 ---
  const postsListContainer = document.getElementById("postsList");
  postsListContainer?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const id = target.getAttribute("data-id");
    if (!id) return;

    if (target.classList.contains("edit-btn")) {
      // 【解耦機制】不需要 import 編輯器邏輯，直接發送事件
      window.dispatchEvent(new CustomEvent("open-edit-modal", { detail: { id } }));
    } 
    else if (target.classList.contains("delete-btn")) deletePost(id);
  });

  // --- 2. 新增文章按鈕 ---
  newPostBtn?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("open-edit-modal"));
  });

  // --- 3. 使用者設定邏輯 ---
  settingsBtn?.addEventListener("click", () => {
    $<HTMLInputElement>("nickname").value = getNickname();
    settingsModal.classList.replace("hidden", "flex");
  });

  settingsForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    setNickname($<HTMLInputElement>("nickname").value);
    settingsModal.classList.replace("flex", "hidden");
    alert("設定已保存");
  });

  logoutBtn?.addEventListener("click", () => logout());
}

async function deletePost(id: string) {
  if (!confirm("確定要刪除嗎？")) return;
  try {
    await axios.delete(`/admin/posts`, {
      params: { id },
      headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` }
    });
    window.location.reload();
  } catch (error: any) {
    alert("刪除失敗");
  }
}