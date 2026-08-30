// components/EditModal/formHelpers.ts
import { type Post, type Category, type UpdatePostPayload } from "../../utils/postManager";
import { type ModalElements } from "./types";

export const formatDateTime = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

export const formHelpers = {
  /** 填充編輯資料至表單 */
  fillForm(els: ModalElements, post: Post, existingCoverImage?: string) {
    if (post.published_at) {
      els.publishedAtInput.value = formatDateTime(new Date(post.published_at));
    }
    els.titleInput.value = post.title;
    els.slugInput.value = post.slug || "";
    els.authorInput.value = post.author_name;
    els.summaryInput.value = post.summary || "";
    els.statusSelect.value = post.status;

    const cover = post.cover_image || existingCoverImage;
    if (cover) {
      els.imagePreview.src = cover;
      els.previewContainer.classList.remove("hidden");
    }
  },

  /** 收集表單數據，包裝成後端需要的 Payload */
  buildPayload(
    els: ModalElements,
    contentData: any,
    allCategories: Category[],
    finalCoverImage?: string | any
  ): UpdatePostPayload {
    const selectedCatIds = Array.from(
      els.categoriesContainer.querySelectorAll("input:checked")
    ).map((i) => parseInt((i as HTMLInputElement).value, 10));

    const statusValue = els.statusSelect.value === "published" ? "published" : "draft";
    const customSlug = els.slugInput.value.trim();

    return {
      title: els.titleInput.value,
      slug: customSlug || undefined, // 若有輸入則傳送自訂 slug，留空則由後端根據標題自動生成
      author_name: els.authorInput.value,
      content: JSON.stringify(contentData),
      summary: els.summaryInput.value,
      status: statusValue,
      categories: allCategories.filter((c) => selectedCatIds.includes(c.id)),
      cover_image: finalCoverImage,
      published_at: els.publishedAtInput.value || undefined,
    };
  },
};