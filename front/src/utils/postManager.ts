/**
 * ==============================================================================
 * 前端文章管理工具 (Frontend Post Helper & Re-exports)
 * ==============================================================================
 * 提供給 Astro 頁面與組件使用的輔助函式，並導出共用的型別與 API 客戶端
 */

export * from "../types/post";
export { postAPI } from "./postAPI";

/**
 * 前端 Slug 生成器
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-\u4e00-\u9fa5]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 從 Editor.js JSON 提取純文字摘要
 */
export function extractSummary(editorData: string, maxLength = 120): string {
  try {
    const data = JSON.parse(editorData);
    let text = "";
    if (Array.isArray(data.blocks)) {
      for (const block of data.blocks) {
        if (block.type === "paragraph" || block.type === "header") {
          const blockText = (block.data?.text || "").replace(/<[^>]*>?/gm, "");
          text += blockText + " ";
          if (text.length >= maxLength) break;
        }
      }
    }
    return text.substring(0, maxLength).trim();
  } catch {
    return editorData.replace(/<[^>]*>?/gm, "").substring(0, maxLength).trim();
  }
}
