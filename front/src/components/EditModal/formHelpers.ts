// components/EditModal/formHelpers.ts
import { type Post, type Category } from "../../utils/postManager";
import { type ModalElements } from "./types";

export const formatDateTime = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

export const formHelpers = {
  /** 填充編輯資料至表單 */
  fillForm(els: ModalElements, post: Post, existingCoverImage: string) {
    if (post.published_at) {
      els.publishedAtInput.value = formatDateTime(new Date(post.published_at));
    }
    els.titleInput.value = post.title;
    els.authorInput.value = post.author_name;
    els.summaryInput.value = post.summary || "";
    els.statusSelect.value = post.status;
    
    if (post.cover_image) {
      els.imagePreview.src = post.cover_image;
      els.previewContainer.classList.remove("hidden");
    }
  },

  /** 收集表單數據，包裝成後端需要的 Payload */
  buildPayload(els: ModalElements, contentData: any, allCategories: Category[], finalCoverImage: string) {
    const selectedCatIds = Array.from(els.categoriesContainer.querySelectorAll('input:checked'))
      .map(i => parseInt((i as HTMLInputElement).value));

    return {
      title: els.titleInput.value,
      author_name: els.authorInput.value,
      content: JSON.stringify(contentData),
      summary: els.summaryInput.value,
      status: els.statusSelect.value,
      categories: allCategories.filter(c => selectedCatIds.includes(c.id)),
      cover_image: finalCoverImage,
      published_at: els.publishedAtInput.value,
    };
  }
};