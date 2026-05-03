// tools/hash.js
const crypto = require('crypto');

// 在這裡輸入你想設定的密碼
const password = 'admin123';

// 使用 SHA-256 演算法
const hash = crypto.createHash('sha256').update(password).digest('hex');

console.log('--- 雜湊產生器 ---');
console.log('原始密碼:', password);
console.log('雜湊結果 (放入 D1):', hash);
console.log('----------------');