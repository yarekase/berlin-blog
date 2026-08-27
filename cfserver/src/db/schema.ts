import { sqliteTable, text, integer, primaryKey, check, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ==========================================
// 管理員表 (admins)
// ==========================================
export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nickname: text("nickname").notNull(),
  createdAt: text("created_at").notNull(),
});

// ==========================================
// 文章表 (posts)
// 注意：coverImageId沒有被做成FK，因此在刪除封面圖時，api要額外處理
// ==========================================
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()), // 隨機 UUID 字串
  title: text("title").notNull(),
  authorName: text("author_name").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(), // 儲存 Editor.js 的 JSON 字串
  summary: text("summary"),
  coverImageId: text("cover_image_id"),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  draftToken: text("draft_token"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  publishedAt: text("published_at"),

},
  // 檢查區
  (table) => [
    check(
      "posts_status_check",
      sql`${table.status} IN ('draft', 'published')`
    ),
  ]
);

// ==========================================
// 分類表 (categories)
// ==========================================
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(99),
});

// ==========================================
// 文章與分類關聯表 (post_categories, 多對多)
// ==========================================
export const postCategories = sqliteTable("post_categories", {
  postId:
    text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
  categoryId:
    integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
},
  (table) =>
    [primaryKey({
      columns: [table.postId, table.categoryId]
    }),
    index(
      "idx_post_categories_category_id",
    ).on(table.categoryId),
    ]

);



// ==========================================
// 圖片表(images)，存放R2資料桶裡的原檔url以及轉換後的WebP url
// ==========================================
export const images = sqliteTable(
  "images", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }), // 文章刪除時，圖片一起刪除
  originalKey: text("original_key").notNull(),
  originalUrl: text("original_url").notNull(),
  webpKey: text("webp_key"),
  webpUrl: text("webp_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`)
},
  (table) => [

    index("idx_images_post_id")
      .on(table.postId),

    index("idx_images_post_sort_order")
      .on(
        table.postId,
        table.sortOrder
      ),
  ]
);


// ==========================================
// ORM 關係定義 (Relations)
// ==========================================
// posts的關聯
export const postsRelations = relations(posts, ({ one, many }) => ({
  // 文章與分類的多對多
  postCategories: many(postCategories),
  // 文章與圖片的一對多
  images: many(images, { relationName: "postImages" }),
  // 文章與封面圖的一對一
  coverImage: one(images, {
    relationName: "postCoverImage",
    fields: [posts.coverImageId],
    references: [images.id]
  }),

}));

// images的關聯
export const imagesRelations = relations(images, ({ one }) => ({
  // 與 postsRelations 的 images (many) 做雙向對接
  post: one(posts, {
    fields: [images.postId],
    references: [posts.id],
    relationName: "postImages",
  }),
}));

// categories的關聯
export const categoriesRelations = relations(categories, ({ many }) => ({
  postCategories: many(postCategories),
}));

// post跟Categories的中間件關聯
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