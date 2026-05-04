/**
 * 【頁面協調中心】
 * 負責處理儀表板的全域邏輯，例如身份驗證、登出、以及將請求「分發」給對應的模態框。
 */
import api from "../utils/api";
import {authManager} from "../utils/auth";

/**
 * DOM 輔助函數
 */
function $<T>(id: string, required = true): T {
  const el = document.getElementById(id);
  if (!el && required) throw new Error(`Necessary DOM element #${id} missing.`);
  return el as unknown as T;
}

/**
 * 初始化儀表板邏輯
 * 這個函式會在瀏覽器端執行，負責綁定所有按鈕事件與權限檢查
 */
export function initDashboard() {
  // 1. 權限檢查：如果 localStorage 沒有 Token，直接導向登入頁
  authManager.checkAuth();

  // 取得頁面上的 DOM 元素
  const settingsModal = $<HTMLDivElement>("settingsModal");
  const newPostBtn = $<HTMLButtonElement>("newPostBtn");
  const settingsBtn = $<HTMLButtonElement>("settingsBtn");
  const logoutBtn = $<HTMLButtonElement>("logoutBtn");
  const settingsForm = $<HTMLFormElement>("settingsForm");
  const nicknameInput = $<HTMLInputElement>("nickname");

  // --- 2. 文章列表動作監聽 (使用「事件委託」 Event Delegation) ---
  // 為什麼不直接在每個按鈕綁監聽？
  // 因為文章列表是動態生成的，或者數量很多。在父容器綁一個監聽器更有效率。
  const postsListContainer = $<HTMLDivElement>("postsList");
  postsListContainer?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const id = target.getAttribute("data-id");
    if (!id) return;

    // 點擊「編輯」
    if (target.classList.contains("edit-btn")) {
      // 【解耦機制】使用自定義事件 CustomEvent
      // 好處：dashboard.ts 不需要知道 EditModal.astro 內部怎麼實作的。
      // 只要發出「我要開模態框」的信號，那邊有聽到的話就會自己打開。
      window.dispatchEvent(new CustomEvent("open-edit-modal", { detail: { id } }));
    } 
    // 點擊「刪除」
    else if (target.classList.contains("delete-btn")) deletePost(id);
  });

  // --- 3. 新增文章按鈕 ---
  newPostBtn?.addEventListener("click", () => {
    // 同樣發送解耦事件，但不帶 id，讓模態框進入「新增模式」
    window.dispatchEvent(new CustomEvent("open-edit-modal"));
  });

  // --- 4. 使用者設定邏輯 (暱稱修改) ---
  settingsBtn?.addEventListener("click", () => {
    // 打開設定視窗前，先填入目前的暱稱
    $<HTMLInputElement>("nickname").value = authManager.getNickname();
    settingsModal.classList.replace("hidden", "flex");
  });

  settingsForm?.addEventListener("submit",async (e) => {
    e.preventDefault();
    // 儲存暱稱至 localStorage (僅影響本地顯示，通常是為了讓「作者名稱」預設填入)
    const newNickname = nicknameInput.value.trim();
    if (!newNickname) {
      alert("暱稱不能為空");
      return;
    }

    try {
      await api.put("/profile", { nickname: newNickname });
      authManager.setNickname(newNickname);
      settingsModal.classList.replace("flex", "hidden");
      alert("設定已保存");
      window.location.reload(); // 刷新頁面以更新顯示的暱稱
    } catch (error) {
      alert("保存設定時發生錯誤");
  }
  });

  // 登出邏輯：清除 Token 並轉址
  logoutBtn?.addEventListener("click", () => authManager.logout());
}

/**
 * 刪除文章的 API 呼叫
 * @param id 文章 UUID
 */
async function deletePost(id: string) {
  if (!confirm("確定要刪除嗎？")) return;
  try {
    // 改用 api 實例，會自動帶入 baseURL (/admin/posts) 與 Authorization Header
    await api.delete("/", {
      params: { id }
    });
    // 刪除成功後刷新頁面
    window.location.reload();
  } catch (error: any) {
    alert("刪除失敗");
  }
}