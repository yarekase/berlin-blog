import { authManager } from "../../utils/auth";
import { type Post, type Category } from "../../utils/postManager";
import { initEditor, saveEditorContent, destroyEditor } from "../../utils/editorManager";
import api from "../../utils/api";
import type { ModalElements } from "./types";
import { CategoryService } from "./categoryService";
import { formHelpers, formatDateTime } from "./formHelpers";

// 創建模態框處理器，接收 DOM 元素集合作為參數
export function createModalHandler(els: ModalElements) {
  // 當前正在編輯的文章 ID，null 表示新增文章
  let currentPostId: string | null = null;
  // 編輯文章時已存在的封面圖片 URL
  let existingCoverImage = "";
  // 區分新增與編輯模式的標誌
  let isEditMode = false;

  // 初始化分類服務，負責管理分類的加載與渲染
  const categoryService = new CategoryService(els);


  /**
   * 打開模態框，用於新增或編輯文章
   * @param id 文章 ID，如果為 null 則為新增模式
   */
  const openModal = async (id: string | null = null) => {
    els.form.reset(); // 重置表單
    els.previewContainer.classList.add("hidden"); // 隱藏圖片預覽區
    existingCoverImage = ""; // 清空已存在的封面圖片

    try {
      // 獲取所有分類
      await categoryService.loadCategories();

      // 有id表示編輯模式
      if (id) {
        isEditMode = true;
        currentPostId = id;
        els.modalTitle.textContent = "編輯文章";

        // 根據 ID 獲取文章詳情
        const { data: post } = await api.get<Post>(`/posts/${id}`);
        existingCoverImage = post.cover_image; // 記錄已存在的封面圖片

        formHelpers.fillForm(els, post, existingCoverImage); // 填充表單字段
        categoryService.render(post.categories.map(c => c.id)); // 渲染分類選擇框，並選中已有分類
        await initEditor(post.content ? JSON.parse(post.content) : null); // 初始化 Editor.js 並載入文章內容
      }else {
        // 新增模式
        isEditMode = false; 
        els.modalTitle.textContent = "新增文章（草稿建立中...）";
        // 預設作者名稱為當前管理員的暱稱
        const nickName = authManager.getNickname() || "";
        // 立刻向後端發送請求，建立一筆新的文章草稿，獲取 ID 後再載入編輯器，確保後續的內容保存和分類添加都能正確關聯到這筆草稿
        const { data: draftPost } = await api.post<Post>("/posts", {
          title: "未命名文章",
          author_name: nickName,
          status: "draft"
        });
        currentPostId = draftPost.id;
        els.modalTitle.textContent = "新增文章（草稿建立完成）";
        els.titleInput.value = draftPost.title;
        els.authorInput.value = draftPost.author_name;
        els.statusSelect.value = draftPost.status;
        els.publishedAtInput.value = formatDateTime(new Date(draftPost.created_at));

        // 渲染空的分類選擇框
        categoryService.render([]);
        setTimeout(() => initEditor(), 50);
      }

      // 建立完成後打開彈窗
      els.modal.classList.replace("hidden", "flex");
    } catch (err) { 
      console.error("載入模態框資料失敗", err);
      alert("載入失敗");
      currentPostId = null;
    }
  };

  /**
   * 表單提交處理函數
   * @param e 事件對象
   */
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    // 防禦性檢查有沒有正確建立ID
    if (!currentPostId) {
      alert("文章 ID 不存在，無法保存");
      return;
    }
    els.submitBtn.disabled = true; // 禁用提交按鈕防止重複提交
    els.submitBtn.textContent = "儲存中..."; // 更改按鈕文本

    try {
      let finalCoverImage = existingCoverImage;
      // 如果有選擇新的封面圖片，則上傳
      if (els.coverInput.files?.[0]) {
        const formData = new FormData();
        formData.append("file", els.coverInput.files[0]);
        const uploadRes = await api.post("/upload", formData);
        // 如果上傳成功，更新封面圖片 URL
        if (uploadRes.data.success === 1) finalCoverImage = uploadRes.data.file.url;
      }

      // 保存 Editor.js 內容
      const contentData = await saveEditorContent(); //
      // 構建文章數據 payload
      const payload = formHelpers.buildPayload(
        els, 
        contentData, 
        categoryService.allCategories, 
        finalCoverImage
      );
      
      await api.put(`/posts/${currentPostId}`, payload); // 修正：ID 放在 URL，payload 直接作為請求體
      alert("文章更新成功！");
      
      localStorage.removeItem("editor_draft"); // 提交成功後清空 localStorage 中的草稿
      window.location.reload(); // 刷新頁面以顯示最新數據
    } catch (error:any) {
      console.error("完整錯誤資訊:", error); // 在控制台印出具體細節
      // 嘗試抓取後端回傳的錯誤訊息
      const errorMsg = error.response?.data?.message || error.message || "未知錯誤";
      alert(`保存失敗: ${errorMsg}`);
      els.submitBtn.disabled = false; // 重新啟用提交按鈕
      els.submitBtn.textContent = "保存"; // 恢復按鈕文本
    }
  };

  // 關閉模態框的邏輯
  const closeModal = () => {
    els.modal.classList.replace("flex", "hidden"); // 隱藏模態框
    destroyEditor(); // 銷毀 Editor.js 實例
    currentPostId = null; // 重置當前文章 ID
  };

  // 自動幫「取消」按鈕綁定關閉事件，解決你找不到設定的問題
  els.cancelBtn.onclick = closeModal;

  // 返回模態框操作函數
  return { 
    openModal,
    handleSubmit,
    closeModal,
    handleAddCategory: () => categoryService.handleAddCategory()
    };
}