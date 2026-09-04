/**
 * 核心型別定義。
 *
 * 這裡只放跨層共用的型別（UI ↔ domain ↔ services）。
 * 只在單一模組內使用的型別就定義在該模組裡，不要集中到這裡，
 * 否則這個檔案會慢慢長成一份沒人敢刪的雜物清單 —— 重構前它就有
 * AppSettings、StockApiResponse、RebalanceAlert、RecurringInvestmentPlan
 * 四個型別完全沒有任何程式碼在使用。
 */

/** 股票或 ETF 的即時報價 */
export interface Stock {
  symbol: string
  name: string
  price: number
  /** 今日漲跌金額 */
  change: number
  /** 今日漲跌幅 % */
  changePercent: number
  /** 報價取得時間，用於判斷快取是否過期 */
  lastUpdate: number
  type: 'ETF' | 'STOCK'
  marketCap?: number
  pe?: number
  dividendYield?: number
  category?: string
}

/** 投資組合中的一筆持倉 */
export interface PortfolioItem {
  id: string
  stock: Stock
  /** 在組合中的目標配置比例 % */
  allocationPercentage: number
  investedAmount: number
  currentValue: number
  unrealizedGain: number
  unrealizedGainPercent: number
  purchaseDate: number
  notes?: string
}

/** 一個完整的投資組合 */
export interface Portfolio {
  id: string
  name: string
  description?: string
  items: PortfolioItem[]
  /** 使用者設定的目標金額，0 = 未設定 */
  targetAmount: number
  totalInvested: number
  totalValue: number
  totalGain: number
  totalGainPercent: number
  investmentGoal: 'RETIREMENT' | 'HOME' | 'SAVINGS' | 'EDUCATION' | 'OTHER'
  investmentYears?: number
  createdDate: number
  lastModified: number
  isDefault: boolean
}

/** 預設配置模板 */
export interface RecommendedConfiguration {
  id: string
  name: string
  description: string
  items: {
    symbol: string
    percentage: number
    type: 'ETF' | 'STOCK'
  }[]
  riskLevel: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'
}

// ── 公司基本面 ──

/**
 * 基本面數值。
 *
 * `null` 的語意是「這個數字取不到」，**不等於 0**。
 * 這個區分是整份財務計算的地基：Alpha Vantage 的 OVERVIEW 端點對缺漏欄位
 * 回傳字串 `"None"`、或根本不回傳該鍵，若在 adapter 層用 `parseFloat(x) || 0`
 * 一律壓成 0，下游就再也分不出「負債為零的公司」與「沒有負債資料的公司」。
 * 前者該拿滿分，後者根本不該計分 —— 壓成 0 會讓每一檔股票都拿到同一個假分數。
 *
 * 因此凡是「可能取不到」的欄位一律 `number | null`，由 domain 層決定
 * 缺漏時要排除計分還是給零分，而不是讓 adapter 悄悄替它決定。
 */
export type Fundamental = number | null

/** 基本面資料的來源，決定了它能被信任到什麼程度 */
export type OverviewSource = 'alpha-vantage' | 'manual'

/** 公司基本面資料（Alpha Vantage OVERVIEW 端點或使用者手動輸入） */
export interface CompanyOverview {
  symbol: string
  name: string
  sector: string
  industry: string
  /** 資料來源。手動輸入的數字未經來源驗證，UI 必須標示出來 */
  source: OverviewSource
  /** 資料取得時間。基本面是季報級資料，過期程度會影響判讀 */
  retrievedAt: number

  marketCap: Fundamental
  peRatio: Fundamental
  pegRatio: Fundamental
  /** 股東權益報酬率 % */
  roe: Fundamental
  debtToEquity: Fundamental
  /** 淨利率 % */
  profitMargin: Fundamental
  /** 營業利益率 % */
  operatingMargin: Fundamental
  /** 季度營收年增率 % */
  revenueGrowthYOY: Fundamental
  /** 季度盈餘年增率 % */
  earningsGrowthYOY: Fundamental
  /** 股息率 % */
  dividendYield: Fundamental
  /** 每股淨值 */
  bookValue: Fundamental
  priceToBook: Fundamental
  eps: Fundamental
  currentRatio: Fundamental
  week52High: Fundamental
  week52Low: Fundamental
  movingAvg50: Fundamental
  movingAvg200: Fundamental
  analystTargetPrice: Fundamental
}

// ── 價格 ──

/**
 * 一個帶來源標記的價格。
 *
 * 為什麼不用裸 `number`：本應用有兩種價格來源，可信度差很多 ——
 *  - `quote`：GLOBAL_QUOTE 端點的即時成交價。
 *  - `derived`：由 `P/E × EPS` 反推。P/E 與 EPS 都是 TTM 口徑，
 *    相乘得到的是「該基本面快照對應的價格」而非此刻的市價，兩者
 *    可能差好幾天甚至一季。
 *
 * 把 basis 帶在型別上，UI 就無法在不標示來源的情況下把它顯示成「現價」，
 * 也讓「用推導價算出的 52 週位置」這種判讀能被正確地打上折扣。
 */
export interface PriceQuote {
  value: number
  basis: 'quote' | 'derived'
}

/** 單一買點訊號 */
export interface BuySignal {
  id: string
  name: string
  triggered: boolean
  value: string
  detail: string
}

/** 買點綜合評估 */
export interface BuySignalResult {
  /** 評估所依據的價格；無可用價格時為 null，此時多數訊號無法計算 */
  price: PriceQuote | null
  signals: BuySignal[]
  triggeredCount: number
  verdict: 'STRONG_BUY' | 'CONSIDER' | 'WAIT' | 'AVOID' | 'INSUFFICIENT_DATA'
  verdictText: string
}

/** 巴菲特選股的單一指標評分 */
export interface BuffettCriterion {
  name: string
  description: string
  value: Fundamental
  displayValue: string
  /** 資料缺漏時為 false —— 未通過與無從判斷是兩件事，看 `available` 區分 */
  pass: boolean
  /** 是否有資料可評。false 時本項不計入總分，也不計入分母 */
  available: boolean
  /** 該指標的滿分權重，六項加總為 100 */
  weight: number
  score: number
  benchmark: string
}

/** 評分的資料完整度 —— 決定這個分數可不可信 */
export interface DataCompleteness {
  /** 有資料可評的權重合計（滿分 100） */
  availableWeight: number
  /** 缺漏指標的名稱，UI 需如實列出 */
  missing: string[]
  /** 低於門檻時不發布評級（見 MIN_RATABLE_WEIGHT） */
  isRatable: boolean
}

/** 合理價估算結果 */
export interface FairValueResult {
  /** 比價基準；無可用價格時為 null，此時溢折價無意義 */
  price: PriceQuote | null
  /** 葛拉漢公式：√(22.5 × EPS × 每股淨值) */
  grahamNumber: number | null
  /** PEG = 1 原則：EPS × 盈餘成長率（成長率上限 25） */
  pegFairValue: number | null
  /** 保守法：EPS × 15 */
  conservativeValue: number | null
  fairValueLow: number
  fairValueHigh: number
  fairValueMid: number
  verdict: 'UNDERVALUED' | 'FAIR' | 'OVERVALUED' | 'EXPENSIVE' | 'NO_PRICE'
  /** 正 = 溢價 %，負 = 折價 %。無比價基準時為 null */
  premiumDiscount: number | null
  /** 含 25% 安全邊際的建議買入價 */
  suggestedBuyPrice: number
  /** 資料不足以估值時為 false —— 此時所有價格欄位皆無意義，不可顯示 */
  canCalculate: boolean
}

/** 巴菲特選股分析結果 */
export interface BuffettAnalysis {
  symbol: string
  name: string
  source: OverviewSource
  analyzedAt: number
  /** 0 ~ 100，在有資料的權重上正規化。資料不足以評級時為 null */
  totalScore: number | null
  /** NR = Not Rated，資料不足以給出評級（沿用信評機構的慣例） */
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | 'NR'
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID' | 'INSUFFICIENT_DATA'
  criteria: BuffettCriterion[]
  completeness: DataCompleteness
  summary: string
  /** UNKNOWN = 判斷護城河所需的指標缺漏，與「沒有護城河」不同 */
  moatStrength: 'WIDE' | 'NARROW' | 'NONE' | 'UNKNOWN'
}
