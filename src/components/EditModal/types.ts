import type { Category } from "../../utils/postManager";

export interface ModalElements {
  modal: HTMLElement;
  form: HTMLFormElement;
  modalTitle: HTMLElement;
  submitBtn: HTMLButtonElement;
  coverInput: HTMLInputElement;
  imagePreview: HTMLImageElement;
  previewContainer: HTMLElement;
  categoriesContainer: HTMLElement;
  newCatInput: HTMLInputElement;
  statusSelect: HTMLSelectElement;
}

export interface PostPayload {
  title: string;
  author_name: string;
  content: string;
  summary: string;
  status: string;
  categories: Category[];
  cover_image: string;
}