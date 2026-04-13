# 投資組合顧問 - Investment Portfolio Advisor

為上班族設計的智能投資推薦和管理工具

## 🎯 功能概述

這個項目幫助上班族建立和管理投資組合，具有以下主要功能：

### 核心功能（已實現）
- ✅ **投資組合管理**：創建、編輯、刪除和查看投資組合
- ✅ **推薦配置系統**：5 種預設配置（保守、平衡、積極、股息、科技）
- ✅ **平衡配置**：ETF 70% + 個股 30% 的默認配置
- ✅ **本地存儲**：使用 IndexedDB 實現本地數據持久化
- ✅ **狀態管理**：Zustand 全局狀態管理
- ✅ **反應式 UI**：實時更新和計算

### 開發中/計劃功能
- 🔄 **API 集成**：Alpha Vantage API 獲取實時股票數據
- 📊 **定期定額投資**：設置每月自動投資計劃
- 🔔 **加碼提醒系統**：市場下跌時自動/手動提醒加碼
- 📈 **績效追蹤**：詳細的投資收益率計算
- ☁️ **雲端同步**：未來集成 Firebase 實現多設備同步
- 💡 **智能建議**：基於市場數據的投資建議

## 🏗️ 項目結構

```
investment-portfolio-advisor/
├── src/
│   ├── components/          # React 組件（保留用於未來擴展）
│   ├── hooks/              # 自定義 React Hooks
│   │   └── usePortfolio.ts # 投資組合管理 Hook
│   ├── pages/              # 頁面組件
│   │   └── HomePage.tsx    # 首頁
│   ├── services/           # 業務邏輯服務
│   │   ├── firebase.ts     # Firebase 配置
│   │   ├── stockAPI.ts     # 股票 API 服務 + 緩存
│   │   ├── storage.ts      # IndexedDB 存儲層
│   │   └── recommendedConfigs.ts  # 推薦配置
│   ├── stores/             # Zustand 狀態存儲
│   │   └── portfolioStore.ts
│   ├── types/              # TypeScript 類型定義
│   │   └── index.ts
│   ├── App.tsx             # 根組件
│   ├── App.css             # 應用樣式
│   ├── index.css           # 全局樣式 + Tailwind
│   └── main.tsx            # 應用入口
├── index.html              # HTML 入口
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
├── tailwind.config.ts      # Tailwind CSS 配置
├── postcss.config.js       # PostCSS 配置
├── package.json            # 項目依賴
├── .env                    # 環境變量（本地開發）
└── .env.example            # 環境變量示例
```

## 🚀 快速開始

### 環境要求
- Node.js 18+
- npm 7+

### 安裝依賴

```bash
cd project/investment-portfolio-advisor
npm install
```

### 開發模式

```bash
npm run dev
```

應用將在 `http://localhost:3000` 啟動

### 生產構建

```bash
npm run build
```

### 類型檢查

```bash
npm run type-check
```

## ⚙️ 配置說明

### Firebase 配置（可選）

未來若要啟用雲端同步：

1. 到 [Firebase Console](https://console.firebase.google.com) 創建項目
2. 複製 `.env.example` 為 `.env`
3. 填入 Firebase 配置值
4. 解除 `src/services/firebase.ts` 中的相關代碼

### Alpha Vantage API（可選）

若要使用實時股票數據：

1. 到 [Alpha Vantage](https://www.alphavantage.co) 獲取免費 API 密鑰
2. 在 `.env` 中設置 `VITE_ALPHA_VANTAGE_API_KEY`

**注意**：免費方案限制為每分鐘 5 個請求，每天 500 個請求，已實現緩存機制

## 📚 核心概念解析

### 架構設計

```
UI Components
    ↓
Custom Hooks（業務邏輯）
    ↓
Zustand Store（全局狀態）
    ↓
Service Layer（業務服務）
    ├─ stockAPI.ts（API + 緩存）
    ├─ storage.ts（數據持久化）
    └─ recommendedConfigs.ts（配置）
    ↓
數據層
├─ IndexedDB（本地存儲）
├─ Firebase（未來雲端）
└─ Alpha Vantage（股票數據）
```

### 分層存儲設計

目前使用 IndexedDB（本地），未來可無縫遷移到 Firebase：

```typescript
// 現在：使用 IndexedDB
const storageService = new StorageService()
await storageService.savePortfolio(portfolio)

// 未來：可替換為 Firebase 實現，上層代碼無需改動
// class FirebaseStorageService implements IStorageService { ... }
```

### 狀態管理流程

1. **組件** 使用 `usePortfolio()` Hook
2. **Hook** 從 Zustand Store 讀取狀態
3. **Store** 更新全局狀態
4. **Service** 執行業務邏輯（API 調用、存儲）
5. **數據層** 持久化到 IndexedDB/Firebase

## 📖 主要類型說明

### Portfolio（投資組合）
```typescript
{
  id: string              // 唯一標識
  name: string            // 組合名稱
  items: PortfolioItem[]  // 持倉列表
  targetAmount: number    // 目標金額
  totalValue: number      // 當前市值
  investmentGoal: string  // 投資目標（退休/買房等）
}
```

### Stock（股票）
```typescript
{
  symbol: string          // 股票代碼（AAPL、VOO）
  price: number           // 當前價格
  changePercent: number   // 漲跌幅
  type: 'ETF' | 'STOCK'  // 類型
  lastUpdate: number      // 最後更新時間
}
```

### 推薦配置

提供 5 種預設配置，包含股票和 ETF 的建議配置比例：
- 🛡️ **保守派**：債券 30%，ETF 70%
- ⚖️ **平衡派**：個股 30%，ETF 70%（推薦）
- 🚀 **積極派**：成長/科技股 50%，ETF 50%
- 💰 **股息派**：高股息股票和 ETF
- 💻 **科技派**：科技和創新股票

## 🛠️ 開發指南

### 添加新功能

1. 在適當的 `service` 中添加業務邏輯
2. 在 `Hook` 中暴露 API
3. 在 `components` 中使用 Hook
4. 類型定義更新到 `types/index.ts`

### 添加新頁面

1. 在 `pages/` 創建新組件
2. 從 `App.tsx` 導入和使用
3. 使用 `usePortfolio()` 或其他 Hook 管理狀態

### 調試

開發模式下，右下角會顯示調試信息：
- 📊 投資組合數量
- 🎯 當前活躍投資組合

在瀏覽器控制台檢查日誌：
```javascript
// 檢查 API 緩存
console.log(stockAPIService.getCacheStats())

// 清除緩存
stockAPIService.clearCache()

// 導出數據
const data = await storageService.exportData()
```

## 🎨 樣式系統

使用 **Tailwind CSS 4** + **自訂組件類**：

```html
<!-- 自訂組件類（定義在 index.css） -->
<div class="card">卡片內容</div>
<button class="btn-primary">主要按鈕</button>
<button class="btn-secondary">次要按鈕</button>

<!-- 投資相關顏色 -->
<span class="text-bull">上漲（綠色）</span>
<span class="text-bear">下跌（紅色）</span>
```

## 📋 注释規範

所有代碼包含詳細的中文注釋：

- **文件頭部**：解釋文件用途
- **函數/類**：説明參數和返回值
- **複雜邏輯**：分步驟注釋
- **為什麼**：注釋解釋設計決策

## 📊 未來擴展方向

### 第一階段（當前）
- 基本的投資組合管理
- 本地數據存儲
- 推薦配置系統

### 第二階段
- Firebase 集成（雲端同步）
- 實時股票數據（Alpha Vantage）
- 加碼提醒系統

### 第三階段
- 自動化投資執行（對接券商 API）
- AI 投資建議
- 稅務優化建議
- 社區分享功能

## 🔐 安全性說明

- 所有 API 密鑰存儲在 `.env`（不提交到 Git）
- `vite.env.d.ts` 確保類型安全
- 敏感操作需要二次確認
- 無本地存儲密鑰，交由 Firebase 管理

## 📞 問題排除

### 開發服務器無法啟動

```bash
# 檢查 Node.js 版本
node --version

# 清除 node_modules 並重新安裝
rm -rf node_modules package-lock.json
npm install

# 清除 Vite 緩存
rm -rf .vite

# 重新啟動
npm run dev
```

### 類型錯誤

```bash
# 檢查類型
npm run type-check

# 查看 tsconfig.json 確保路徑別名正確
```

### IndexedDB 問題

```javascript
// 清除所有數據
await storageService.clearAll()

// 重新加載頁面
window.location.reload()
```

## 📄 許可證

MIT License

## 👨‍💻 開發者註記

這個項目展示了現代 React 應用開發的最佳實踐：

- ✅ TypeScript 完整類型支持
- ✅ 分層架構設計（易於維護和擴展）
- ✅ 自定義 Hooks 重用邏輯
- ✅ 小型狀態管理庫（Zustand）
- ✅ IndexedDB 本地持久化
- ✅ 詳細的中文註釋解釋代碼

享受編碼！🚀
