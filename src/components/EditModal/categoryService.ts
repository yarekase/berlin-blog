// components/EditModal/categoryService.ts
import api from "../../utils/api";
import { type Category } from "../../utils/postManager";
import { type ModalElements } from "./types";

export class CategoryService {
  private els: ModalElements;
  public allCategories: Category[] = [];

  constructor(els: ModalElements) {
    this.els = els;
  }

  async loadCategories() {
    const { data } = await api.get<Category[]>("/categories");
    this.allCategories = data;
  }

  render(selectedIds: number[]) {
    this.els.categoriesContainer.innerHTML = this.allCategories.map(cat => `
      <label class="flex items-center space-x-2 text-sm text-slate-300">
        <input type="checkbox" value="${cat.id}" ${selectedIds.includes(cat.id) ? "checked" : ""} 
               class="rounded border-white/20 bg-void-black text-primary focus:ring-primary">
        <span>${cat.name}</span>
      </label>
    `).join("");
  }

  async handleAddCategory() {
    const name = this.els.newCatInput.value.trim();
    if (!name) return alert("請輸入分類名稱");

    const isDuplicate = this.allCategories.some(
      cat => cat.name === name || cat.slug === name.toLowerCase()
    );
    if (isDuplicate) return alert("這個分類已經存在囉！");

    try {
      const { data: newCategory } = await api.post<Category>("/categories", { name });
      this.allCategories.push(newCategory);

      const currentSelected = Array.from(
        this.els.categoriesContainer.querySelectorAll('input[type="checkbox"]:checked')
      ).map(el => Number((el as HTMLInputElement).value));

      currentSelected.push(newCategory.id);
      this.render(currentSelected);
      this.els.newCatInput.value = "";
    } catch (err: any) {
      if (err.response?.status === 409) alert("新增失敗：分類名稱或 Slug 已被佔用");
      else alert("伺服器連線失敗，請稍後再試");
    }
  }
}