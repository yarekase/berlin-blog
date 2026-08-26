import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ==========================================
// 1. 管理員表 (admins)
// ==========================================
export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nickname: text("nickname").notNull(),
  createdAt: text("created_at").notNull(),
});

// ==========================================
// 2. 文章表 (posts)
// ==========================================
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(), // 隨機 UUID 字串
  title: text("title").notNull(),
  authorName: text("author_name").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(), // 儲存 Editor.js 的 JSON 字串
  summary: text("summary"),
  coverImage: text("cover_image").notNull(),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  draftToken: text("draft_token").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  publishedAt: text("published_at"),
});

// ==========================================
// 3. 分類表 (categories)
// ==========================================
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(99),
});

// ==========================================
// 4. 文章與分類關聯表 (post_categories, 多對多)
// ==========================================
export const postCategories = sqliteTable("post_categories", {
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.categoryId] }),
}));

// ==========================================
// ORM 關係定義 (Relations)
// ==========================================
export const postsRelations = relations(posts, ({ many }) => ({
  postCategories: many(postCategories),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  postCategories: many(postCategories),
}));

export const postCategoriesRelations = relations(postCategories, ({ one }) => ({
  post: one(posts, {
    fields: [postCategories.postId],
    references: [posts.id],
  }),
  category: one(categories, {
    fields: [postCategories.categoryId],
    references: [categories.id],
  }),
}));
