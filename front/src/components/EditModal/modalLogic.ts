/**
 * ==============================================================================
 * 文章編輯彈窗核心邏輯 (EditModal Logic)
 * ==============================================================================
 * 負責文章的「新增草稿」與「編輯儲存」掛勾流程：
 * 1. 打開彈窗：
 *    - 編輯模式：呼叫 postAPI.getPostById(id) 載入文章資料並初始化 Editor.js
 *    - 新增模式：呼叫 postAPI.createPost() 預先在 D1 資料庫建立一筆空白草稿，取得 UUID 後綁定編輯器
 * 2. 儲存送出：
 *    - 圖片處理：若有選擇新封面圖，透過 postAPI.uploadImage 上傳至 R2
 *    - 內容封裝：Editor.js 內容轉換為 JSON，並透過 postAPI.updatePost 更新回 D1 資料庫
 */

import { authManager } from "../../utils/auth";
import { postAPI } from "../../utils/postManager";
import { initEditor, saveEditorContent, destroyEditor } from "../../utils/editorManager";
import type { ModalElements } from "./types";
import { CategoryService } from "./categoryService";
import { formHelpers, formatDateTime } from "./formHelpers";

export function createModalHandler(els: ModalElements) {
  // 當前正在編輯的文章 ID (UUID)，null 表示未載入
  let currentPostId: string | null = null;
  // 編輯文章時已存在的封面圖片 URL / ID
  let existingCoverImage = "";
  // 區分新增與編輯模式的標誌
  let isEditMode = false;

  // 初始化分類服務，負責管理分類的加載與核選框渲染
  const categoryService = new CategoryService(els);

  /**
   * 打開模態框 (新增或編輯)
   * @param id 文章 UUID，若為 null 則代表為新增模式
   */
  const openModal = async (id: string | null = null) => {
    els.form.reset(); // 重置表單欄位
    els.previewContainer.classList.add("hidden"); // 隱藏圖片預覽區
    existingCoverImage = ""; // 清空已存在的封面圖片

    try {
      // 1. 預先載入最新分類列表
      await categoryService.loadCategories();

      if (id) {
        // --- 編輯模式 ---
        isEditMode = true;
        currentPostId = id;
        els.modalTitle.textContent = "編輯文章";

        // 透過 postAPI 取得後端 Drizzle 提供的文章詳情
        const post = await postAPI.getPostById(id);
        existingCoverImage = post.cover_image || "";

        // 填充表單欄位、勾選已有分類並初始化 Editor.js
        formHelpers.fillForm(els, post, existingCoverImage);
        categoryService.render((post.categories || []).map((c) => c.id));
        await initEditor(post.content ? JSON.parse(post.content) : null);
      } else {
        // --- 新增模式 (自動建立草稿) ---
        isEditMode = false;
        els.modalTitle.textContent = "新增文章（草稿建立中...）";

        const nickName = authManager.getNickname() || "子迂";

        // 向後端發送請求在 D1 建立一筆空白草稿，取得由資料庫生成的 UUID
        const draftPost = await postAPI.createPost({
          title: "未命名文章",
          author_name: nickName,
          status: "draft",
        });

        currentPostId = draftPost.id;
        els.modalTitle.textContent = "新增文章（草稿建立完成）";
        els.titleInput.value = draftPost.title;
        els.slugInput.value = draftPost.slug || "";
        els.authorInput.value = draftPost.author_name;
        els.statusSelect.value = draftPost.status;
        els.publishedAtInput.value = formatDateTime(new Date(draftPost.created_at));

        // 渲染無選取的分類，並延遲啟動空白 Editor.js
        categoryService.render([]);
        setTimeout(() => initEditor(), 50);
      }

      // 開啟彈窗
      els.modal.classList.replace("hidden", "flex");
    } catch (err) {
      console.error("[EditModal Error] 載入彈窗資料失敗:", err);
      alert("載入資料失敗，請確認網路連線或登入狀態");
      currentPostId = null;
    }
  };

  /**
   * 表單提交處理函式 (儲存/發布文章)
   */
  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!currentPostId) {
      alert("文章 ID 不存在，無法保存");
      return;
    }

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "儲存中...";

    try {
      let finalCoverImage: any = existingCoverImage;

      // 1. 檢查是否有選擇新上傳的封面圖片
      if (els.coverInput.files?.[0]) {
        const uploadRes = await postAPI.uploadImage(els.coverInput.files[0]);
        if (uploadRes && uploadRes.success === 1) {
          finalCoverImage = {
            original_key: uploadRes.file.original_key,
            original_url: uploadRes.file.original_url,
            webp_key: uploadRes.file.webp_key,
            webp_url: uploadRes.file.webp_url,
          };
        }
      }

      // 2. 擷取 Editor.js 編輯器內容
      const contentData = await saveEditorContent();

      // 3. 組裝 Payload
      const payload = formHelpers.buildPayload(
        els,
        contentData,
        categoryService.allCategories,
        finalCoverImage
      );

      // 4. 呼叫 postAPI 更新資料庫
      await postAPI.updatePost(currentPostId, payload);
      alert(isEditMode ? "文章更新成功！" : "文章發布成功！");

      localStorage.removeItem("editor_draft"); // 清除暫存
      window.location.reload(); // 重新載入以展示最新文章表格
    } catch (error: any) {
      console.error("[EditModal Error] 儲存失敗:", error);
      const errorMsg =
        error.response?.data?.error || error.response?.data?.message || error.message || "未知錯誤";
      alert(`保存失敗: ${errorMsg}`);
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = "保存";
    }
  };

  /**
   * 關閉彈窗並銷毀編輯器實例
   */
  const closeModal = () => {
    els.modal.classList.replace("flex", "hidden");
    destroyEditor();
    currentPostId = null;
  };

  // 綁定取消按鈕關閉事件
  els.cancelBtn.onclick = closeModal;

  return {
    openModal,
    handleSubmit,
    closeModal,
    handleAddCategory: () => categoryService.handleAddCategory(),
  };
}