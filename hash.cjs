const crypto = require('crypto');

const password = ''; // 這裡可以換成你想要測試的密碼
const salt = ''; // 這裡要跟 Cloudflare 上的一致

// 建議公式：SHA-256(密碼 + 鹽)
const hash = crypto.createHash('sha256')
                   .update(password + salt) // 把鹽加進去一起湊
                   .digest('hex');

console.log('--- 安全雜湊產生器 ---');
console.log('雜湊結果 (放入 D1):', hash);