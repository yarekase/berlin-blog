export class AppError extends Error {
    // statusCode 必須是標準的 HTTP 狀態碼數字 (例如 400, 401, 409, 500)
    constructor(public statusCode: number, message: string) {
        super(message);
        this.name = "AppError";
    }
}