/**
 * 認證管理工具
 */

export function checkAuth(): void {
  if (!localStorage.getItem("adminToken")) {
    window.location.href = "/admin/login";
  }
}

export function logout(): void {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin/login";
}

export function getNickname(): string {
  return localStorage.getItem("adminNickname") || "";
}

export function setNickname(nickname: string): void {
  localStorage.setItem("adminNickname", nickname);
}
