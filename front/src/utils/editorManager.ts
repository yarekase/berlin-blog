/**
 * Editor.js 管理工具
 * 負責 Editor.js 的初始化和生命週期管理
 */

export let editor: any = null;

/**
 * 初始化 Editor.js
 * @param data - 編輯器的初始數據
 */
export async function initEditor(data: any = null): Promise<void> {
  try {
    // 如果已有編輯器，先銷毀
    if (editor) {
      await editor.destroy();
    }

    // 動態導入 Editor.js 和工具
    const { default: EditorJS } = await import("@editorjs/editorjs");
    const { default: Header } = await import("@editorjs/header");
    const { default: List } = await import("@editorjs/list");
    const { default: Quote } = await import("@editorjs/quote");
    const { default: Delimiter } = await import("@editorjs/delimiter");
    const { default: Embed } = await import("@editorjs/embed");

    editor = new EditorJS({
      holder: "editorjs",
      data: data,
      placeholder: "開始寫作...",
      tools: {
        header: {
          class: Header as any,
          inlineToolbar: true,
        },
        list: {
          class: List as any,
          inlineToolbar: true,
        },
        quote: {
          class: Quote as any,
          inlineToolbar: true,
        },
        delimiter: Delimiter as any,
        embed: {
          class: Embed as any,
          inlineToolbar: true,
        },
      },
    } as any);
  } catch (error) {
    console.error("Editor.js 初始化失敗:", error);
    setupFallbackEditor(data);
  }
}

/**
 * 保存編輯器內容
 * @returns 編輯器內容數據
 */
export async function saveEditorContent(): Promise<any> {
  try {
    if (editor) {
      return await editor.save();
    } else {
      // 使用回退 textarea
      const fallbackEditor = document.getElementById(
        "fallbackEditor",
      ) as HTMLTextAreaElement | null;
      return fallbackEditor
        ? {
            blocks: [
              { type: "paragraph", data: { text: fallbackEditor.value } },
            ],
          }
        : { blocks: [] };
    }
  } catch (error) {
    console.error("保存內容失敗:", error);
    return { blocks: [] };
  }
}

/**
 * 清理編輯器
 */
export async function destroyEditor(): Promise<void> {
  if (editor) {
    try {
      await editor.destroy();
    } catch (error) {
      console.error("銷毀編輯器失敗:", error);
    }
    editor = null;
  }
}

/**
 * 設置回退編輯器（當 Editor.js 加載失敗時）
 */
function setupFallbackEditor(data: any): void {
  const editorDiv = document.getElementById(
    "editorjs",
  ) as HTMLDivElement | null;
  if (editorDiv) {
    editorDiv.innerHTML =
      '<textarea id="fallbackEditor" class="w-full h-full bg-void-black text-white border-none outline-none resize-none" placeholder="開始寫作..."></textarea>';
    const fallbackEditor = document.getElementById(
      "fallbackEditor",
    ) as HTMLTextAreaElement | null;
    if (fallbackEditor && data) {
      fallbackEditor.value = data.blocks
        ? data.blocks.map((block: any) => block.data.text || "").join("\n\n")
        : "";
    }
  }
}
