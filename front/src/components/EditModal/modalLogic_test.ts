// components/EditModal/modalLogic.ts
import { authManager } from "../../utils/auth";
import { type Post } from "../../utils/postManager";
import { initEditor, saveEditorContent, destroyEditor } from "../../utils/editorManager";
import api from "../../utils/api";
import type { ModalElements } from "./types";
import { CategoryService } from "./categoryService";
import { formHelpers, formatDateTime } from "./formHelpers";

export function createModalHandler(els: ModalElements) {
  let currentPostId: string | null = null;
  let existingCoverImage = "";
  let isEditMode = false;

  // 實例化分類服務
  const categoryService = new CategoryService(els);

  const openModal = async (id: string | null = null) => {
    els.form.reset();
    els.previewContainer.classList.add("hidden");
    existingCoverImage = "";

    try {
      // 1. 載入分類
      await categoryService.loadCategories();

      if (id) {
        // 【編輯模式】
        isEditMode = true;
        currentPostId = id;
        els.modalTitle.textContent = "編輯文章";

        const { data: post } = await api.get<Post>(`/posts/${id}`);
        existingCoverImage = post.cover_image;
        
        formHelpers.fillForm(els, post, existingCoverImage);
        categoryService.render(post.categories.map(c => c.id));
        await initEditor(post.content ? JSON.parse(post.content) : null);
      } else {
        // 【新增模式】
        isEditMode = false;
        els.modalTitle.textContent = "新增文章（草稿建立中...）";

        const nickname = authManager.getNickname() || "匿名";
        const { data: draftPost } = await api.post<Post>("/posts", {
          title: "未命名文章",
          author_name: nickname,
          status: "draft"
        });

        currentPostId = draftPost.id;
        els.modalTitle.textContent = "新增文章";

        els.titleInput.value = draftPost.title;
        els.authorInput.value = draftPost.author_name;
        els.statusSelect.value = draftPost.status;
        els.publishedAtInput.value = formatDateTime(new Date());

        categoryService.render([]);
        setTimeout(() => initEditor(), 50);
      }

      els.modal.classList.replace("hidden", "flex");
    } catch (err) {
      console.error(err);
      alert("載入失敗");
      currentPostId = null;
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!currentPostId) return alert("錯誤：找不到對應的文章 ID");

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "儲存中...";

    try {
      let finalCoverImage = existingCoverImage;
      if (els.coverInput.files?.[0]) {
        const formData = new FormData();
        formData.append("file", els.coverInput.files[0]);
        const uploadRes = await api.post("/upload", formData);
        if (uploadRes.data.success === 1) finalCoverImage = uploadRes.data.file.url;
      }

      const contentData = await saveEditorContent();
      
      // 構建 Payload
      const payload = formHelpers.buildPayload(
        els, 
        contentData, 
        categoryService.allCategories, 
        finalCoverImage
      );

      await api.put(`/posts/${currentPostId}`, payload);
      alert(isEditMode ? "文章更新成功！" : "文章新增成功！");

      localStorage.removeItem("editor_draft");
      window.location.reload();
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.message || error.message || "未知錯誤";
      alert(`保存失敗: ${errorMsg}`);
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = "保存";
    }
  };

  const closeModal = () => {
    els.modal.classList.replace("flex", "hidden");
    destroyEditor();
    currentPostId = null;
  };

  els.cancelBtn.onclick = closeModal;

  // 暴露給外部（如控制中心）的接口
  return { 
    openModal, 
    handleSubmit, 
    closeModal, 
    handleAddCategory: () => categoryService.handleAddCategory() 
  };
}