/**
 * 【頁面協調中心】
 * 負責處理儀表板的全域邏輯，例如身份驗證、登出、以及將請求「分發」給對應的模態框。
 */
import api from "../utils/api";
import {authManager} from "../utils/auth";
import {postAPI} from "../utils/postAPI";

/**
 * DOM 輔助函數
 */
function $<T>(id: string, required = true): T {
  const el = document.getElementById(id);
  if (!el && required) throw new Error(`DOM元素#${id}不存在`);
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
  const postsListContainer = $<HTMLDivElement>("postsList");

  if (!settingsModal || !newPostBtn || !settingsBtn || !settingsForm || !postsListContainer) {
    throw new Error("必要的 DOM 元素不存在，請檢查 HTML 結構");
  }

  // --- 2. 文章列表動作監聽 (使用「事件委託」 Event Delegation) ---
  postsListContainer?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    // 使用closest，當點擊子元素時，系統會往上找class為edit-btn或delete-btn的父元素，這樣可以確保點擊到按鈕的任何位置都能觸發事件
    const editBtn = target.closest(".edit-btn");
    const deleteBtn = target.closest(".delete-btn");

    if (editBtn){
      const id = editBtn.getAttribute("data-id");
      if (id) {
        window.dispatchEvent(new CustomEvent("open-edit-modal", { detail: { id } }));
      } else{
        console.error("編輯按鈕缺少 data-id 屬性");
      }}
        
        
    if (deleteBtn) {
        const id = deleteBtn.getAttribute("data-id");
        if (!id) {
          console.error("刪除按鈕缺少 data-id 屬性");
          return;
        }
        if (confirm("確定要刪除這篇文章嗎？")) {
          postAPI.deletePost(id)
            .then(() => {
              alert("文章已刪除");
              window.location.reload(); // 刪除後刷新頁面
            })
            .catch((err) => {
              console.error("刪除文章失敗", err);
              alert("刪除文章失敗，請稍後再試");
            });
        }
      }
    }
  );

  // --- 3. 新增文章按鈕 ---
  newPostBtn?.addEventListener("click", () => {
    // 同樣發送解耦事件，但不帶 id，讓模態框進入「新增模式」
    window.dispatchEvent(new CustomEvent("open-edit-modal"));
  });

  // --- 4. 使用者設定邏輯 (暱稱修改) ---
  settingsBtn?.addEventListener("click", () => {
    // 打開設定視窗前，先填入目前的暱稱
    nicknameInput.value = authManager.getNickname();
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

