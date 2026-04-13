import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vite 配置文件
// Vite 是一個快速的前端開發構建工具
// 這個配置告訴 Vite 如何構建我們的 React 項目

export default defineConfig({
  // 使用 React 插件以支持 JSX
  plugins: [react()],

  // 路徑別名配置（與 tsconfig.json 保持一致）
  // 這允許我們在代碼中使用 @/ 代替 ../../../
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },

  // 開發服務器配置
  server: {
    // 使用 3000 端口
    port: 3000,
    // 自動打開瀏覽器
    open: true,
    // 啟用 CORS
    cors: true,
  },

  // 構建配置
  build: {
    // 目標文件夾
    outDir: 'dist',
    // 輸出清空舊文件
    emptyOutDir: true,
    // 分塊大小警告閾值
    chunkSizeWarningLimit: 1000,
  },
})
