/** @type {import('tailwindcss').Config} */
export default {
	// 掃描src資料夾中(包含子資料夾)所有副檔名為astro,html,js,jsx等等的檔案
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
	  // 保留預設值的同時，增加以下設定
    extend: {
      colors: {
        "primary": "#ec1313",      // 凸顯用的紅色
        "void-black": "#0a0a0a",   // 背景用的黑色
      },
      fontFamily: {
        // 導覽、按鈕、閱讀時間等相對理性的字體
        "display": ["Inter", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "sans-serif"], 
        // 誇張的字體
        "serif": ["'Playfair Display'", "Noto Serif TC", "Songti TC", "serif"], 
      },
      // 沒有圓角
      borderRadius: {
        "none": "0px",
      }
    },
  },
  // 以後要放插件的地方
  plugins: [],
}