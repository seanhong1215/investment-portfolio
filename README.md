# 投資組合分析 · Portfolio Analytics

[![CI](https://github.com/seanhong1215/investment-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/seanhong1215/investment-portfolio/actions/workflows/ci.yml)

以核心衛星策略為主軸的投資組合分析工具。依目標與風險偏好產生個人化配置，追蹤各組合的
損益與資產分佈，並以價值投資指標評估個股體質與合理買進區間。

**Demo：<https://investment-portfolio-liard.vercel.app/>**

> React 19 · TypeScript · Vite · Zustand · Tailwind 4 · Vitest
> 純前端（本地優先，可選 Firebase 雲端同步）· 深淺色雙主題

| | |
|---|---|
| 原始碼 | 5,596 行 / 40 檔（不含測試） |
| 測試 | 180 個，1,269 行 / 7 檔 |
| 覆蓋率 | lines 99.6% · branches 94.4%（逐檔門檻 90 / 85） |
| 主 bundle | 95 KB gzip（Firebase 106 KB 動態載入） |
| 型別 | `strict` 全開，`tsc --noEmit` 零錯誤 |

零設定即可執行：不需要任何金鑰，儲存使用 IndexedDB，個股研究使用手動輸入模式。

---

## 核心設計

### 缺漏資料與零值在型別上分離

外部 API 的缺漏欄位一律轉為 `null`，不轉為 0。

```ts
/** null 的語意是「這個數字取不到」，不等於 0 */
export type Fundamental = number | null
```

對評分的影響：

- 缺漏的指標**同時退出分子與分母**，分數在實際可評的權重上正規化，而非固定除以 100。
- 可評權重低於 60 分時不發布評級，顯示 `NR`（Not Rated）。
- 介面明列哪些指標因缺資料未納入計分。
- 手動輸入模式遵循同一規則：空欄位為 `null`。表單送出門檻直接引用
  `CRITERION_WEIGHTS` 與 `MIN_RATABLE_WEIGHT`，兩者不會不一致。

實務意義：Alpha Vantage 免費 `OVERVIEW` 端點不提供 `DebtToEquityRatio` 與
`CurrentRatio`。若將缺漏視為 0，負債項恆為滿分、流動比率項恆為零分，100 分中有 25 分
與公司體質無關。

### 價格帶來源標記

```ts
export interface PriceQuote {
  value: number
  basis: 'quote' | 'derived'   // 即時報價 / 由 P/E × EPS 反推
}
```

`derived` 由 `P/E × EPS` 反推，兩者均為 TTM 口徑，對應的是基本面快照當時的價格。
介面因此無法在未標示來源的情況下將其顯示為「現價」。

無價格時，合理價區間仍可計算（僅需 EPS 與帳面值），但溢折價為 `null`、verdict 為
`NO_PRICE`。

### 外部請求的節流與快取

`AlphaVantageClient` 以 promise 佇列序列化請求，併發呼叫會排隊而非同時送出。
快取為配額機制的一部分而非效能優化：報價 30 分鐘、基本面 2 小時，時間來源可注入以供測試。

### 錯誤以分類分支

`AlphaVantageError` 帶 `kind` 與 `recoverableByManualInput`。介面依旗標決定是否提示
改用手動輸入：配額用盡時提示，標的為 ETF 時不提示。不以訊息字串比對。

### 資料呈現的誠信約束

- `AnalystTargetPrice` 為不具名共識，文案一律使用「共識目標價」，不掛任何機構名稱，
  並有測試斷言。
- 三個頁面皆會輸出建議形狀的內容，免責聲明置於應用層級，文字取自 domain 單一常數。

---

## 架構

```
src/
├── domain/          純函數領域層 —— 不依賴 React、不碰 I/O
│   ├── portfolioMetrics.ts   損益、配置佔比、核心衛星比重、再平衡偏離、目標進度
│   ├── buffett.ts            巴菲特評分、合理估價、買點訊號、價格來源解析
│   ├── advisor.ts            依「風險 × 年限」12 種組合產生配置與複利試算
│   └── presets.ts            五種預設配置模板
│
├── services/
│   ├── alphaVantage/         外部資料進入系統的唯一入口
│   │   ├── mapping.ts          純函數：欄位對應、單位換算、錯誤分類
│   │   ├── client.ts           I/O：fetch、節流佇列、快取
│   │   └── ttlCache.ts         帶存活時間的快取（時間來源可注入）
│   ├── portfolioRepository.ts  儲存介面（兩個實作都必須符合，編譯期把關）
│   ├── indexedDbRepository.ts  本地實作（離線可用，亦為雲端失敗時的退路）
│   ├── firestoreRepository.ts  雲端實作（動態載入）
│   └── storage.ts              後端選擇與退回策略
│
├── stores/          Zustand 全域狀態（非同步動作收在 store 內，狀態只有一份）
├── components/
│   ├── ui/          原子元件（Button／Card／StatTile／Badge…，以 CVA 管理變體）
│   └── charts/      資料視覺化（配置堆疊條 + 色票指派規則）
└── pages/           三大頁面：建立組合 / 投資組合 / 個股研究
```

- `domain/` 與 `services/` 的界線區隔「計算是否正確」與「資料存放於何處」。更換儲存
  後端只需新增一個 `PortfolioRepository` 實作；調整評分規則只需變更 `domain/`。
- `alphaVantage/` 內部再切分純對應邏輯與 I/O。欄位名稱與單位換算的錯誤型別檢查無法
  攔截，分離後以固定樣本 payload 即可測試，無須攔截網路。
- 兩個儲存實作皆 `implements PortfolioRepository`，簽章不一致在編譯期被攔下。
  雲端不可用時自動退回本地。

---

## 工程決策

**總額由持倉推導。** 每次以 `calcPortfolioTotals(items)` 重算，不作增量加減，
總額與持倉不可能不一致。

**除以零由測試守住，而非防禦性程式碼。** `gainPercent()` 在投入為 0 時回傳 0；
`projectFV()` 在年化 0% 時退化為單純累加。兩者皆有對應測試。

**查表以型別保證完全性。** `ETF_INFO` 與 `STOCK_INFO` 使用 `as const satisfies`，
key 為字面量聯集，配置表加入未登錄代碼會成為編譯錯誤，程式碼中無 fallback 分支。

**金額使用 `number` 是刻意的取捨。** 本專案為分析與顯示工具，不具備科目餘額、對帳，
或金額累加須與另一份紀錄完全相符的需求，浮點誤差落在顯示精度以下。若延伸為記帳系統，
正確作法是改用最小貨幣單位的整數或 decimal 型別，並將幣別納入型別。

---

## 設計系統

- **單一 token 來源。** 顏色定義於 `index.css` 的 CSS 變數，透過 Tailwind 4 的
  `@theme inline` 讓 utility 直接引用。淺／深色僅需變更單一處，元件層無 `dark:` 前綴。
- **類別色票依固定順序指派，不循環。** 順序即色盲安全機制（相鄰色差最大化）。超過
  8 個標的折入「其他」（中性灰）。
- **顏色依標的而定，不依排名而定。** 篩選標的時其餘不換色。
- **不以顏色作為唯一表意通道。** 漲跌以箭頭方向與顏色雙通道編碼；指標卡片的
  「通過 / 未通過 / 無資料」三種狀態各有獨立圖示。
- **part-to-whole 採水平堆疊條而非圓餅圖。** 持股常有 8 至 9 檔，圓餅圖在超過 6 個
  區段時難以判讀。

配色在 `#ffffff`（淺）與 `#16181d`（深）兩個表面色上，各自通過色盲分離度、對比、
色度等六項檢查。

---

## 效能

環境判斷（`firebaseConfig.ts`，不 import firebase）與 SDK 初始化分離，Firestore 以動態
`import()` 載入，Vite 切為獨立 chunk：

| | 主 bundle (gzip) |
|---|---|
| 靜態載入 Firebase | 199 KB |
| 動態載入 Firebase | **95 KB**（Firebase 106 KB 獨立 chunk，僅在設定雲端時載入） |

---

## 測試策略

覆蓋率門檻逐檔套用（`perFile: true`），設於兩層：

- **`domain/`** —— 財務計算，錯誤直接影響使用者的資金判斷。
- **`services/alphaVantage/`** —— 外部資料進入系統的唯一入口，欄位名稱、單位換算、
  缺漏值語意的錯誤型別檢查無法攔截。

逐檔而非聚合平均，避免高覆蓋率的檔案掩蓋低覆蓋率的檔案。UI 樣式不設門檻。
測試以 `testFactories.ts` 提供預設值，每條測試僅覆寫其驗證的欄位；驗證缺漏資料時
明確寫入 `null`。

涵蓋範圍：

- `advisor.ts` 全部 12 種「風險 × 年限」組合的配置正確性
- 巴菲特六項指標的權重與邊界，含缺資料與零分區分的整組迴歸測試
- 合理估價三種公式的數值正確性（對照獨立計算），及無比價基準時不判斷貴賤
- adapter 層：`None`、缺鍵、`NaN` 轉為 `null`、比率換算百分比、API 錯誤分類
- client 層：併發節流、快取命中、失敗不寫入快取、單次失敗不影響後續請求
- 除以零、空組合、超額達成等邊界狀況

---

## 開始使用

```bash
npm install
npm run dev           # 開發（http://localhost:3000）
npm test              # 執行 180 個單元測試
npm run test:coverage # 覆蓋率（逐檔門檻：lines/functions 90%、branches 85%）
npm run type-check    # 型別檢查
npm run build         # 型別檢查 + 生產建置
```

每次 push 與 PR 皆會在 GitHub Actions 執行型別檢查、覆蓋率門檻與生產建置
（`.github/workflows/ci.yml`）。

### 部署

靜態站台，任何支援 Vite 的平台皆可直接部署，全部使用預設值：

| 設定 | 值 |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| 環境變數 | 不需要 |

以狀態切換頁面而非 URL 路由，僅有單一進入點，無須 SPA rewrite 設定。

### 選用設定

**Firebase 雲端同步**（未設定則使用本地 IndexedDB）：複製 `.env.example` 為 `.env`，
填入 `VITE_FIREBASE_*` 值。Firestore 安全規則見 `firestoreRepository.ts` 檔頭。

**Alpha Vantage 即時報價**（個股研究的「API 自動查詢」模式）：於 `.env` 設定
`VITE_ALPHA_VANTAGE_API_KEY`，免費版每日 25 次。額度用盡時可切換至「手動輸入」模式，
功能一致；由於免費端點不提供負債股權比與流動比率，手動輸入可讓評分納入完整六項指標。

---

## 授權

MIT
