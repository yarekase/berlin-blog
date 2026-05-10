import { authManager } from "../../utils/auth";
import { type Post, type Category } from "../../utils/postManager";
import { initEditor, saveEditorContent, destroyEditor } from "../../utils/editorManager";
import api from "../../utils/api";
import type { ModalElements } from "./types";

export function createModalHandler(els: ModalElements) {
  let currentPostId: string | null = null;
  let allCategories: Category[] = [];
  let existingCoverImage = "";

  const renderCategories = (selectedIds: number[]) => {
    els.categoriesContainer.innerHTML = allCategories.map(cat => `
      <label class="flex items-center space-x-2 text-sm text-slate-300">
        <input type="checkbox" value="${cat.id}" ${selectedIds.includes(cat.id) ? "checked" : ""} 
               class="rounded border-white/20 bg-void-black text-primary focus:ring-primary">
        <span>${cat.name}</span>
      </label>
    `).join("");
  };

  const openModal = async (id: string | null = null) => {
    currentPostId = id;
    els.form.reset();
    els.previewContainer.classList.add("hidden");
    existingCoverImage = "";

    try {
      const { data: cats } = await api.get<Category[]>("/categories");
      allCategories = cats;

      if (id) {
        els.modalTitle.textContent = "編輯文章";
        const { data: post } = await api.get<Post>(`/${id}`);
        els.titleInput.value = post.title;
        els.authorInput.value = post.author_name;
        els.summaryInput.value = post.summary || "";
        els.statusSelect.value = post.status;
        existingCoverImage = post.cover_image;

        if (post.cover_image) {
          els.imagePreview.src = post.cover_image;
          els.previewContainer.classList.remove("hidden");
        }
        renderCategories(post.categories.map(c => c.id));
        await initEditor(post.content ? JSON.parse(post.content) : null);
      } else {
        els.modalTitle.textContent = "新增文章";
        (els.form.querySelector("#author_name") as HTMLInputElement).value = authManager.getNickname() || "";
        renderCategories([]);
        setTimeout(() => initEditor(), 50);
      }
      els.modal.classList.replace("hidden", "flex");
    } catch (err) { alert("載入失敗"); }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
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
      const selectedCatIds = Array.from(els.categoriesContainer.querySelectorAll('input:checked'))
        .map(i => parseInt((i as HTMLInputElement).value));

      const payload = {
        title: els.titleInput.value,
        author_name: els.authorInput.value,
        content: JSON.stringify(contentData),
        summary: els.summaryInput.value,
        status: els.statusSelect.value,
        categories: allCategories.filter(c => selectedCatIds.includes(c.id)),
        cover_image: finalCoverImage
      };

      if (currentPostId) {
        await api.put("/posts", { id: currentPostId, updates: payload });
      } else {
        await api.post("/posts", payload);
      }
      window.location.reload();
    } catch (error:any) {
      console.error("完整錯誤資訊:", error); // 在控制台印出具體細節
      // 嘗試抓取後端回傳的錯誤訊息
      const errorMsg = error.response?.data?.message || error.message || "未知錯誤";
      alert("保存失敗");
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = "保存";
    }
  };

  return { openModal, handleSubmit, closeModal: () => {
    els.modal.classList.replace("flex", "hidden");
    destroyEditor();
    currentPostId = null;
  }};
}