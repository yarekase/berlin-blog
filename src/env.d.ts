/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

/** 匯出 Env 供 API 路由 (posts.ts) 使用 */
export interface Env {
  DB: D1Database;
  MY_BUCKET: R2Bucket;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
}

declare global {
  namespace App {
    interface Locals {
      runtime: {
        env: Env;
        cf: import("@cloudflare/workers-types").CfProperties;
        ctx: import("@cloudflare/workers-types").ExecutionContext;
      };
    }
  }
}
