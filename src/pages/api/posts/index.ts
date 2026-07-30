// GET (文章列表), POST (新增文章 + 綁定分類)
import type { APIRoute } from "astro";



// [GET] 獲取文章列表 (包含關聯分類)
export const GET: APIRoute = async ({ request, locals }) => {
  const DB = (locals as any).runtime.env.DB;

  try {
    // 1. 抓取所有文章
    const { results: posts } = await DB.prepare(
      `SELECT id, title, slug, author_name, summary, status, created_at, published_at 
       FROM posts ORDER BY created_at DESC`
    ).all();

    // 2. 抓取文章對應的分類 (多對多查詢)
    const { results: relations } = await DB.prepare(`
      SELECT pc.post_id, c.id as category_id, c.name, c.slug 
      FROM posts_categories pc
      JOIN categories c ON pc.category_id = c.id
    `).all();

    // 3. 把分類組裝進對應的文章物件中
    const postsWithCategories = posts.map((post: any) => {
      const categories = relations
        .filter((r: any) => r.post_id === post.id)
        .map((r: any) => ({ id: r.category_id, name: r.name, slug: r.slug }));
      return { ...post, categories };
    });

    return new Response(JSON.stringify(postsWithCategories), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

// [POST] 新增文章 (包含寫入多對多中間表)
export const POST: APIRoute = async ({ request, locals }) => {
  const DB = (locals as any).runtime.env.DB;

  try {
    const body = await request.json();
    const { title, author_name, slug, content, summary, status, published_at, category_ids } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: "標題為必填欄位" }), { status: 400 });
    }

    // 1. 插入文章本體
    const insertPostStmt = DB.prepare(`
      INSERT INTO posts (title, author_name, slug, content, summary, status, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      title || "未命名草稿",
      author_name,
      slug || `post-${Date.now()}`,
      content,
      summary,
      status || "draft",
      published_at
    );

    const newPost = await insertPostStmt.first<{ id: number }>();
    const postId = newPost?.id;

    // 2. 處理多對多分類關聯 (如果有勾選分類)
    if (postId && Array.isArray(category_ids) && category_ids.length > 0) {
      const batchStatements = category_ids.map((catId: number) =>
        DB.prepare(`INSERT INTO posts_categories (post_id, category_id) VALUES (?, ?)`).bind(postId, catId)
      );
      // 使用 batch 批次寫入
      await DB.batch(batchStatements);
    }

    return new Response(JSON.stringify({ success: true, id: postId }), { status: 201 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
