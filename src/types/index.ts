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

/** Alpha Vantage OVERVIEW 端點的公司基本面資料 */
export interface CompanyOverview {
  symbol: string
  name: string
  sector: string
  industry: string
  marketCap: number
  peRatio: number
  pegRatio: number
  /** 股東權益報酬率 % */
  roe: number
  debtToEquity: number
  /** 淨利率 % */
  profitMargin: number
  /** 營業利益率 % */
  operatingMargin: number
  /** 季度營收年增率 % */
  revenueGrowthYOY: number
  /** 季度盈餘年增率 % */
  earningsGrowthYOY: number
  /** 股息率 % */
  dividendYield: number
  /** 每股淨值 */
  bookValue: number
  priceToBook: number
  eps: number
  currentRatio: number
  week52High: number
  week52Low: number
  movingAvg50: number
  movingAvg200: number
  analystTargetPrice: number
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
  /** 由 P/E × EPS 推算的現價（避免多打一次 API） */
  impliedPrice: number
  signals: BuySignal[]
  triggeredCount: number
  verdict: 'STRONG_BUY' | 'CONSIDER' | 'WAIT' | 'AVOID'
  verdictText: string
}

/** 巴菲特選股的單一指標評分 */
export interface BuffettCriterion {
  name: string
  description: string
  value: number | null
  displayValue: string
  pass: boolean
  /** 該指標的滿分權重，六項加總為 100 */
  weight: number
  score: number
  benchmark: string
}

/** 合理價估算結果 */
export interface FairValueResult {
  marketPrice: number
  /** 葛拉漢公式：√(22.5 × EPS × 每股淨值) */
  grahamNumber: number | null
  /** PEG = 1 原則：EPS × 盈餘成長率（成長率上限 25） */
  pegFairValue: number | null
  /** 保守法：EPS × 15 */
  conservativeValue: number | null
  fairValueLow: number
  fairValueHigh: number
  fairValueMid: number
  verdict: 'UNDERVALUED' | 'FAIR' | 'OVERVALUED' | 'EXPENSIVE'
  /** 正 = 溢價 %，負 = 折價 % */
  premiumDiscount: number
  /** 含 25% 安全邊際的建議買入價 */
  suggestedBuyPrice: number
  /** 資料不足以估值時為 false —— 此時所有價格欄位皆無意義，不可顯示 */
  canCalculate: boolean
}

/** 巴菲特選股分析結果 */
export interface BuffettAnalysis {
  symbol: string
  name: string
  analyzedAt: number
  /** 0 ~ 100 */
  totalScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID'
  criteria: BuffettCriterion[]
  summary: string
  moatStrength: 'WIDE' | 'NARROW' | 'NONE'
}
