import { authManager } from "../../utils/auth";
import { type Post, type Category } from "../../utils/postManager";
import { initEditor, saveEditorContent, destroyEditor } from "../../utils/editorManager";
import api from "../../utils/api";
import type { ModalElements } from "./types";

// 格式化日期時間為 YYYY-MM-DDTHH:MM 格式，適用於 <input type="datetime-local">
const formatDateTime = (date: Date) => {
  // 獲取時區偏移量，並將其轉換為毫秒
  const tzOffset = date.getTimezoneOffset() * 60000; // 偏移量
  // 調整日期以匹配本地時間，然後格式化為 ISO 字符串並截取所需部分
  const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  return localISOTime;
};

// 創建模態框處理器，接收 DOM 元素集合作為參數
export function createModalHandler(els: ModalElements) {
  // 當前正在編輯的文章 ID，null 表示新增文章
  let currentPostId: string | null = null;
  // 所有可用的分類列表
  let allCategories: Category[] = [];
  // 編輯文章時已存在的封面圖片 URL
  let existingCoverImage = "";

  /**
   * 渲染分類選擇框
   * @param selectedIds 已經選中的分類 ID 列表
   */
  const renderCategories = (selectedIds: number[]) => {
    els.categoriesContainer.innerHTML = allCategories.map(cat => `
      <label class="flex items-center space-x-2 text-sm text-slate-300">
        <input type="checkbox" value="${cat.id}" ${selectedIds.includes(cat.id) ? "checked" : ""} 
               class="rounded border-white/20 bg-void-black text-primary focus:ring-primary">
        <span>${cat.name}</span>
      </label>
    `).join("");
  };

  /**
   * 打開模態框，用於新增或編輯文章
   * @param id 文章 ID，如果為 null 則為新增模式
   */
  const openModal = async (id: string | null = null) => {
    currentPostId = id;
    els.form.reset(); // 重置表單
    els.previewContainer.classList.add("hidden"); // 隱藏圖片預覽區
    existingCoverImage = ""; // 清空已存在的封面圖片

    try {
      // 獲取所有分類
      const { data: cats } = await api.get<Category[]>("/categories");
      allCategories = cats;

      if (id) {
        // 編輯模式
        els.modalTitle.textContent = "編輯文章";
        // 根據 ID 獲取文章詳情
        const { data: post } = await api.get<Post>(`/posts/${id}`);
        // 如果有發布時間，則格式化並填入發布時間輸入框
        if (post.published_at) {
          els.publishedAtInput.value = formatDateTime(new Date(post.published_at));
        }
        // 填充表單字段
        els.titleInput.value = post.title;
        els.authorInput.value = post.author_name;
        els.summaryInput.value = post.summary || "";
        els.statusSelect.value = post.status;
        existingCoverImage = post.cover_image;

        // 顯示封面圖片預覽
        if (post.cover_image) {
          els.imagePreview.src = post.cover_image;
          els.previewContainer.classList.remove("hidden");
        }
        // 渲染分類選擇框，並選中文章已有的分類
        renderCategories(post.categories.map(c => c.id));
        // 初始化 Editor.js 並載入文章內容
        await initEditor(post.content ? JSON.parse(post.content) : null);
      } else {
        // 新增模式
        els.publishedAtInput.value = formatDateTime(new Date());
        els.modalTitle.textContent = "新增文章";
        // 預設作者名稱為當前管理員的暱稱
        (els.form.querySelector("#author_name") as HTMLInputElement).value = authManager.getNickname() || "";
        // 渲染空的分類選擇框
        renderCategories([]);
        setTimeout(() => initEditor(), 50);
      }
      els.modal.classList.replace("hidden", "flex");
    } catch (err) { alert("載入失敗"); }
  };

  const handleAddCategory = async () => {
    const name = els.newCatInput.value.trim();
    if (!name) return alert("請輸入分類名稱");

    // 1. 前端初步檢查：是否已經存在於目前的 allCategories 陣列中
    const isDuplicate = allCategories.some(
      cat => cat.name === name || cat.slug === name.toLowerCase()
    );
    
    if (isDuplicate) {
      return alert("這個分類已經存在囉！");
    }

    try {
      // 2. 正式發送 API 到後端
      const { data: newCategory } = await api.post<Category>("/categories", { name });

      // 3. 成功後，更新前端的資料源 (這時 newCategory 包含真正的資料庫 ID)
      allCategories.push(newCategory);

      // 4. 取得目前已經勾選的 ID 陣列
      const currentSelected = Array.from(
        els.categoriesContainer.querySelectorAll('input[type="checkbox"]:checked')
      ).map(el => Number((el as HTMLInputElement).value));

      // 5. 將新分類的 ID 加入勾選清單
      currentSelected.push(newCategory.id);

      // 6. 重新渲染清單
      renderCategories(currentSelected);

      // 7. 清空輸入框
      els.newCatInput.value = "";
      
    } catch (err: any) {
      // 處理 API 回傳的重複報錯 (409) 或其他錯誤
      if (err.response && err.response.status === 409) {
        alert("新增失敗：分類名稱或 Slug 已被佔用");
      } else {
        alert("伺服器連線失敗，請稍後再試");
      }
      console.error(err);
    }
  };

  /**
   * 表單提交處理函數
   * @param e 事件對象
   */
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
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
      // 獲取所有選中的分類 ID
      const selectedCatIds = Array.from(els.categoriesContainer.querySelectorAll('input:checked'))
        .map(i => parseInt((i as HTMLInputElement).value));

      // 構建文章數據 payload
      const payload = {
        title: els.titleInput.value,
        author_name: els.authorInput.value,
        content: JSON.stringify(contentData),
        summary: els.summaryInput.value,
        status: els.statusSelect.value,
        // 過濾出選中的分類對象
        categories: allCategories.filter(c => selectedCatIds.includes(c.id)),
        cover_image: finalCoverImage,
        published_at: els.publishedAtInput.value,
      };

      if (currentPostId) {
        await api.put(`/posts/${currentPostId}`, payload); // 修正：ID 放在 URL，payload 直接作為請求體
        alert("文章更新成功！");
      } else {
        await api.post("/posts", payload);
        alert("文章新增成功！");
      }
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
  return { openModal, handleSubmit, closeModal, handleAddCategory };
}