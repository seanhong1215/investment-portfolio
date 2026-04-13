/**
 * PostCSS 配置文件
 *
 * PostCSS 是一個 CSS 轉換工具
 * 我們使用它與 Tailwind CSS 4 集成
 *
 * Tailwind CSS 4 的 PostCSS 插件已分離到 @tailwindcss/postcss
 */

export default {
  // 使用的 PostCSS 插件
  plugins: {
    // Tailwind CSS 4 PostCSS 插件 - 將 Tailwind 指令轉換為 CSS
    // 注意：使用新的 @tailwindcss/postcss 包
    '@tailwindcss/postcss': {},
  },
}
