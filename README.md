# 投資組合分析 · Portfolio Analytics

以核心衛星策略為主軸的投資組合分析工具。使用者可依目標與風險偏好產生個人化配置，
追蹤各組合的損益與資產分佈，並用價值投資的指標分析個股是否值得買進、何時是合理買點。

> React 19 · TypeScript · Vite · Zustand · Tailwind 4 · Vitest
> 純前端（本地優先，可選 Firebase 雲端同步）· 深淺色雙主題 · 109 個單元測試

---

## 這份作品想展示什麼

這不是一個「功能很多」的專案，而是刻意把**取捨與工程判斷**做清楚：

1. **領域邏輯與 UI 徹底分離。** 所有財務計算（損益、配置佔比、核心衛星比重、巴菲特評分、
   合理估價、複利試算）都是 `src/domain/` 底下的純函數，不 import React、不碰 I/O，因此
   **能被完整測試**。這也讓同一個指標在不同頁面永遠算出相同結果。

2. **測試證明它有用，不是為了覆蓋率數字。** 重構過程中，`presets.test.ts` 的
   「配置比例總和必須是 100%」直接抓到一個潛伏的資料錯誤 —— 原本的「積極配置」加總是
   **104%**，會讓使用者被要求投入超過本金的錢，而且當時整個專案沒有任何測試擋得下來。

3. **設計系統以可驗證的方式建立。** 圖表配色不是憑感覺挑的，而是用色盲安全性驗證腳本
   跑過、對淺色（`#ffffff`）與深色（`#16181d`）兩個實際表面色各自通過六項檢查後才採用。
   詳見〈設計系統〉。

---

## 架構

```
src/
├── domain/          純函數領域層 —— 不依賴 React、不碰 I/O，100% 單元測試覆蓋
│   ├── portfolioMetrics.ts   損益、配置佔比、核心衛星比重、再平衡偏離、目標進度
│   ├── buffett.ts            巴菲特選股評分、合理估價（葛拉漢／PEG／保守 P/E）、買點訊號
│   ├── advisor.ts            依「風險 × 年限」12 種組合產生配置與複利試算
│   └── presets.ts            五種預設配置模板
│
├── services/        I/O 層 —— 邊界都以介面隔開
│   ├── portfolioRepository.ts   儲存介面（兩個實作都必須符合，編譯期把關）
│   ├── indexedDbRepository.ts   本地實作（離線可用，也是雲端失敗時的退路）
│   ├── firestoreRepository.ts   雲端實作（動態載入，見〈效能〉）
│   ├── storage.ts               後端選擇與退回策略
│   └── stockAPI.ts              Alpha Vantage 報價 + 快取
│
├── stores/          Zustand 全域狀態（非同步動作收在 store 內，狀態只有一份）
├── components/
│   ├── ui/          原子元件（Button／Card／StatTile／Badge…，用 CVA 管理變體）
│   └── charts/      資料視覺化（配置堆疊條 + 色票指派規則）
└── pages/           三大頁面：建立組合 / 投資組合 / 個股研究
```

**分層的理由**：`domain/` 與 `services/` 的界線讓「算得對不對」與「存在哪裡」互不干擾。
要換掉儲存後端，只需新增一個 `PortfolioRepository` 的實作；要改評分規則，只動 `domain/`，
且改完 `npm test` 立刻告訴你有沒有破壞既有行為。

---

## 幾個具體的工程決策

**儲存後端用明確介面隔開。** 原本 IndexedDB 與 Firestore 兩個實作只是「碰巧」有同名方法，
沒有型別關係 —— 任一邊改了簽章，TypeScript 不會出聲。現在兩者都 `implements PortfolioRepository`，
不一致會在編譯期就擋下來。雲端不可用時**自動退回本地**而非讓畫面壞掉，因為這個應用沒有雲端
也完全能用。

**總額一律由持倉推導，不做增量加減。** 新增／移除持倉時若手動「總額 ± 這筆金額」，只要有一條
路徑漏算，誤差就永久寫進資料。改成每次都用 `calcPortfolioTotals(items)` 重算後，總額不可能與
持倉不一致。

**除以零是被測試守住的邊界，不是防禦性程式碼。** 剛建立、尚未下單的組合投入金額為 0，直接算
報酬率會得到 `NaN%` 並渲染到畫面上。`gainPercent()` 對這個情況回傳 0，且有對應測試。

---

## 設計系統

顏色是**最後**才決定的，而且用腳本驗證、不靠肉眼判斷。

- **單一 token 來源。** 所有顏色定義在 `index.css` 的 CSS 變數，透過 Tailwind 4 的
  `@theme inline` 讓 utility 直接引用變數 —— 淺／深色只要換一處變數，元件層一個 `dark:`
  前綴都不用寫。
- **類別色票依固定順序指派，永不循環。** 順序本身就是色盲安全機制（相鄰色差最大化）。
  超過 8 個標的的部分折成「其他」（中性灰），而不是生成第 9 個難以辨識的色相。
- **顏色跟著標的走，不跟著排名走。** 篩選掉某個標的時其餘不會換色 ——「VOO 是藍色」這個
  認知不會失效。
- **不只靠顏色表意。** 漲跌同時用箭頭方向與顏色兩個通道編碼；配置圖附**表格對照版**
  （淺色模式下有三個色票對比低於 3:1，這是那條不靠顏色也讀得到值的路徑）。
- **part-to-whole 用水平堆疊條而非圓餅圖。** 投資組合常有 8~9 檔持股，圓餅在超過 6 段或
  數值相近時就讀不出來。

配色以 `#ffffff`（淺）與 `#16181d`（深）兩個表面色各自通過色盲分離度、對比、色度等
六項檢查後才採用。

---

## 效能

**Firebase SDK 動態載入。** 主要問題是 `storage.ts` 靜態 import Firestore 實作，會把整包
Firebase SDK（約 450KB）打進主 bundle，即使使用者沒設定雲端。把環境判斷（`firebaseConfig.ts`，
不 import firebase）與 SDK 初始化拆開後，Firestore 改用動態 `import()`，Vite 自動切成獨立 chunk：

| | 主 bundle (gzip) |
|---|---|
| 拆分前 | 199 KB（含 Firebase） |
| 拆分後 | **93 KB**（Firebase 452KB 切為獨立 chunk，只在有設定雲端時載入） |

---

## 開始使用

```bash
npm install
npm run dev          # 開發（http://localhost:3000）
npm test             # 執行 109 個單元測試
npm run test:coverage # 領域層覆蓋率（門檻：lines/functions 90%、branches 85%）
npm run build        # 型別檢查 + 生產建置
```

### 選用設定

**Firebase 雲端同步**（不設定則使用本地 IndexedDB）：複製 `.env.example` 為 `.env`，
填入 Firebase 專案的 `VITE_FIREBASE_*` 值。Firestore 安全規則見 `firestoreRepository.ts` 檔頭。

**Alpha Vantage 即時報價**（個股研究的「API 自動查詢」模式）：於 `.env` 設定
`VITE_ALPHA_VANTAGE_API_KEY`。免費版每日 25 次；額度用完時可切換到「手動輸入」模式，
從 Yahoo Finance 等免費來源自行填入指標，功能完全一致。

---

## 測試策略

只對 `domain/` 設覆蓋率門檻，因為那裡是財務計算，算錯會直接影響使用者的錢；為了衝高整體
數字去測 UI 樣式沒有意義。測試用 `testFactories.ts` 提供合理預設值，讓每條測試只需覆寫它
真正在意的欄位。

涵蓋範圍包括：`advisor.ts` 全部 12 種「風險 × 年限」組合的配置正確性、巴菲特六項指標的
權重與邊界（虧損企業、P/E 為 0）、合理估價三種公式的數值正確性（對照獨立計算），以及
所有「除以零／空組合／超額達成」的邊界狀況。

---

## 授權

MIT
