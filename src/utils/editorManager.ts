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
    await destroyEditor();

    let initialData = data;
    if (!initialData) {
      const savedDraft = localStorage.getItem("editor_draft");
      if (savedDraft) {
        try {
        initialData = JSON.parse(savedDraft);
        console.log("載入未儲存的資料");
        } catch(e) {
          console.error("無法解析未儲存的資料，將使用空白編輯器",e);
        }
      }
    }

    const [
      { default: EditorJS },
      { default: Header },
      { default: List },
      { default: Quote },
      { default: Delimiter },
      { default: Embed },
      { default: Image },
      { default: Marker }
    ] = await Promise.all([
      import("@editorjs/editorjs"),
      import("@editorjs/header"),
      import("@editorjs/list"),
      import("@editorjs/quote"),
      import("@editorjs/delimiter"),
      import("@editorjs/embed"),
      import("@editorjs/image"),
      import("@editorjs/marker")
    ]);

    editor = new EditorJS({
      holder: "editorjs",
      data: initialData,
      placeholder: "開始寫作...",
      tools: {
        header: {
          class: Header as any,
          inlineToolbar: true,
          config: {
            placeholder: '輸入標題...',
            levels: [1, 2, 3, 4], // 這裡定義 H1 到 H4，讓你可以切換標題大小
            defaultLevel: 2,      // 預設為 H2
          }
        },
        list: {
          class: List as any,
          inlineToolbar: true,
          config: {
            defaultStyle: "unordered",
          },
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
        image: {
          class: Image,
          config: {
            endpoints: {
              byFile: "/api/posts/upload", // 指向你的後端路徑
            },
            field: 'file',
            types: 'image/*',
          },
          
        },
        marker: {
          class: Marker,
          shortcut: "CMD+SHIFT+M", // 也可以設定快速鍵
        },
      },
      onChange: async () => {
          const content = await editor.save();
          localStorage.setItem("editor_draft", JSON.stringify(content));
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
      const savedData =await editor.save();
      localStorage.setItem("editor_draft", JSON.stringify(savedData)); // 暫存內容到 localStorage
      return savedData;
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
