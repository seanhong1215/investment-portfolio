import type { Config } from 'tailwindcss'

/**
 * Tailwind CSS 4 配置文件
 *
 * Tailwind 是一個工具優先的 CSS 框架
 * 這個配置告訴 Tailwind 如何生成樣式
 */

const config: Config = {
  // 指定哪些文件包含需要掃描的 Tailwind 類
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],

  // 主題配置（可自訂顏色、字體、間距等）
  theme: {
    extend: {
      // 自訂顏色（除了默認的 Tailwind 顏色）
      colors: {
        // 投資相關的顏色
        'bull': '#10b981',  // 綠色 - 上漲
        'bear': '#ef4444',  // 紅色 - 下跌
      },
      // 自訂動畫
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },

  // 插件（擴展 Tailwind 功能）
  // 未來可添加 @tailwindcss/forms, @tailwindcss/typography 等
  plugins: [],
}

export default config
