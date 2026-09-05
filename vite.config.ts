/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  // 只保留 @ 一個別名。原本的 @components/@hooks/... 七個別名讓同一個檔案
  // 可以有兩種 import 寫法，反而讓人猶豫該用哪個 — 一種寫法就夠了。
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 3000,
    open: true,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },

  test: {
    // domain/ 是純函數，不碰 DOM — 用 node 環境跑起來比 jsdom 快得多
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // 只量兩層：domain 是財務計算，算錯直接影響使用者的錢；
      // alphaVantage 是外部資料進入系統的唯一入口，欄位對應錯了型別檢查
      // 攔不住，只會讓數字悄悄地不對。為了衝高整體數字去測 UI 樣式沒有
      // 意義，門檻設在真正重要的地方。
      include: ['src/domain/**/*.ts', 'src/services/alphaVantage/**/*.ts'],
      // testFactories 是測試用的基礎設施，不是受測程式碼；
      // index.ts 只是 re-export，沒有行為可測。
      exclude: [
        'src/**/*.test.ts',
        'src/domain/testFactories.ts',
        'src/services/alphaVantage/index.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
