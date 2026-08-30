/**
 * ==============================================================================
 * 上傳模組 - 服務層 (Upload Service with Cloudflare R2)
 * ==============================================================================
 * 職責：
 * 1. 處理檔案轉二進位 (ArrayBuffer)。
 * 2. 儲存原始檔案至 R2 Bucket (`raw/uuid.ext`)。
 * 3. 儲存 WebP 最佳化檔案至 R2 Bucket (`optimized/uuid.webp`)。
 * 4. 組裝公開訪問網址。
 */

export interface UploadResult {
  original_key: string;
  original_url: string;
  webp_key: string | null;
  webp_url: string | null;
}

export class UploadService {
  /**
   * 上傳圖片至 R2 儲存桶
   */
  async uploadImage(
    bucket: R2Bucket,
    publicDomain: string,
    originalFile: File,
    webpFile?: File | null
  ): Promise<UploadResult> {
    const uuid = crypto.randomUUID();

    // 1. 儲存原始檔案
    const originalExt = originalFile.name?.split(".").pop() || "jpg";
    const originalPath = `raw/${uuid}.${originalExt}`;
    await bucket.put(originalPath, await originalFile.arrayBuffer(), {
      httpMetadata: { contentType: originalFile.type },
    });

    // 2. 儲存 WebP 最佳化檔案
    let webpPath: string | null = null;
    if (webpFile) {
      webpPath = `optimized/${uuid}.webp`;
      await bucket.put(webpPath, await webpFile.arrayBuffer(), {
        httpMetadata: { contentType: "image/webp" },
      });
    }

    return {
      original_key: originalPath,
      original_url: `${publicDomain}/${originalPath}`,
      webp_key: webpPath,
      webp_url: webpPath ? `${publicDomain}/${webpPath}` : null,
    };
  }
}

export const uploadService = new UploadService();
