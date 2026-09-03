export interface PasswordValidResult {
  /** 密碼格式是否合法 */
  isValid: boolean;
  /** 驗證失敗時的錯誤提示訊息 */
  message?: string;
}

/**
 * 驗證密碼格式是否合法
 * 規則：
 * 1. 長度必須在 8 到 12 碼之間
 * 2. 只允許包含英文大寫 (A-Z)、英文小寫 (a-z) 與數字 (0-9)
 * 3. 必須至少包含一個英文字母（大寫或小寫）與一個數字
 * 
 * @param password 待驗證的明文字串
 */
export function validPassword(password: string): PasswordValidResult {

  // 1. 長度檢查 (8-12 碼)
  if (password.length < 8 || password.length > 12) {
    return {
      isValid: false,
      message: "密碼格式錯誤",
    };
  }

  // 3. 字元集檢查：只允許英文大小寫與數字，不可含有特殊符號或空格
  const allowedCharsRegex = /^[a-zA-Z0-9]+$/;
  if (!allowedCharsRegex.test(password)) {
    return {
      isValid: false,
      message: "密碼格式錯誤",
    };
  }

  // 4. 組合檢查：必須包含至少一個英文字母 (A-Z 或 a-z)
  const hasLetter = /[a-zA-Z]/.test(password);
  if (!hasLetter) {
    return {
      isValid: false,
      message: "密碼格式錯誤",
    };
  }

  // 5. 組合檢查：必須包含至少一個數字 (0-9)
  const hasNumber = /[0-9]/.test(password);
  if (!hasNumber) {
    return {
      isValid: false,
      message: "密碼格式錯誤",
    };
  }

  return { isValid: true };
}