import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/946b5da6-faea-476c-b5fc-26c9438dee74.sqlite" // 本地 miniflare D1 資料庫路徑
  }
});
