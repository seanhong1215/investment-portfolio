/**
 * 核心類型定義
 *
 * 這個文件定義了整個應用中使用的主要 TypeScript 類型
 * 確保類型安全和代碼可維護性
 */

/**
 * 股票信息類型
 * 表示一支股票的基本信息
 */
export interface Stock {
  // 股票代碼（如 AAPL、MSFT）
  symbol: string;
  // 公司名稱
  name: string;
  // 當前價格
  price: number;
  // 今日漲幅百分比
  changePercent: number;
  // 今日漲跌金額
  change: number;
  // 市場資本化
  marketCap?: number;
  // 本益比（Price-to-Earnings）
  pe?: number;
  // 股息率（年度股息 / 股價）
  dividendYield?: number;
  // 盈利增長率
  earningsGrowth?: number;
  // 最後更新時間戳
  lastUpdate: number;
  // 股票類型（ETF 或 Individual Stock）
  type: 'ETF' | 'STOCK';
  // 分類標籤（科技、金融、消費等）
  category?: string;
}

/**
 * 投資組合項目類型
 * 表示投資組合中的一項持倉
 */
export interface PortfolioItem {
  // 唯一標識符
  id: string;
  // 股票信息
  stock: Stock;
  // 該股票的配置比例（百分比）
  allocationPercentage: number;
  // 已投入金額
  investedAmount: number;
  // 當前市值
  currentValue: number;
  // 未實現損益
  unrealizedGain: number;
  // 未實現收益率
  unrealizedGainPercent: number;
  // 購買時間戳
  purchaseDate: number;
  // 股票備註
  notes?: string;
}

/**
 * 投資組合類型
 * 表示一個完整的投資組合
 */
export interface Portfolio {
  // 唯一標識符
  id: string;
  // 組合名稱
  name: string;
  // 組合描述
  description?: string;
  // 組合內的所有項目
  items: PortfolioItem[];
  // 目標資金（用戶想要存到的目標金額）
  targetAmount: number;
  // 已投入總金額
  totalInvested: number;
  // 當前總市值
  totalValue: number;
  // 總收益
  totalGain: number;
  // 總收益率
  totalGainPercent: number;
  // 投資目標（退休、買房、養老等）
  investmentGoal: 'RETIREMENT' | 'HOME' | 'SAVINGS' | 'EDUCATION' | 'OTHER';
  // 預期投資年限
  investmentYears?: number;
  // 創建時間戳
  createdDate: number;
  // 最後修改時間戳
  lastModified: number;
  // 是否為默認組合
  isDefault: boolean;
}

/**
 * 定期定額計劃類型
 * 表示一個定期定額投資計劃
 */
export interface RecurringInvestmentPlan {
  // 唯一標識符
  id: string;
  // 所屬投資組合 ID
  portfolioId: string;
  // 股票代碼
  stockSymbol: string;
  // 投資金額
  amount: number;
  // 投資頻率（月度）
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  // 計劃開始日期
  startDate: number;
  // 計劃結束日期（如果為 null 則無限期）
  endDate?: number;
  // 是否啟用
  isActive: boolean;
  // 創建時間戳
  createdDate: number;
  // 最後投資時間戳
  lastInvestmentDate?: number;
}

/**
 * 加碼提醒類型
 * 表示一個加碼（追加投資）提醒
 */
export interface RebalanceAlert {
  // 唯一標識符
  id: string;
  // 所屬投資組合 ID
  portfolioId: string;
  // 股票代碼
  stockSymbol: string;
  // 觸發條件類型
  triggerType: 'PRICE_DROP' | 'PRICE_RISE' | 'MANUAL';
  // 觸發條件的具體值（如下跌 5%）
  triggerValue: number;
  // 建議投資金額
  suggestedAmount: number;
  // 是否自動執行
  isAutoExecute: boolean;
  // 是否已觸發
  isTriggered: boolean;
  // 觸發時間（如果已觸發）
  triggeredDate?: number;
  // 是否已處理
  isHandled: boolean;
  // 創建時間戳
  createdDate: number;
}

/**
 * 推薦股票配置類型
 * 表示一個預設的推薦配置
 */
export interface RecommendedConfiguration {
  // 唯一標識符
  id: string;
  // 配置名稱
  name: string;
  // 配置描述
  description: string;
  // 配置中的項目列表
  items: {
    // 股票代碼
    symbol: string;
    // 推薦配置比例
    percentage: number;
    // 股票類型
    type: 'ETF' | 'STOCK';
  }[];
  // 風險等級（保守/平衡/激進）
  riskLevel: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
}

/**
 * 應用設置類型
 * 表示用戶的應用設置
 */
export interface AppSettings {
  // 主題設置（淺色/深色）
  theme: 'light' | 'dark';
  // 貨幣單位（USD/CNY 等）
  currency: 'USD' | 'TWD' | 'CNY';
  // 每週開始日期（0=Sunday, 1=Monday）
  weekStartDay: number;
  // 啟用通知
  enableNotifications: boolean;
  // 加碼提醒嚴重程度（高/中/低）
  alertSensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * 觀察清單項目類型
 * 表示用戶關注的股票或 ETF
 */
export interface WatchlistItem {
  // 唯一標識符
  id: string;
  // 股票代碼
  symbol: string;
  // 股票名稱
  name: string;
  // 添加到觀察清單的時間戳
  addedDate: number;
  // 個人備註
  notes?: string;
  // 目標價格（用戶設定的買入/賣出價格）
  targetPrice?: number;
  // 股票類型
  type: 'ETF' | 'STOCK';
  // 當前價格（最後一次更新）
  currentPrice?: number;
  // 最後更新時間
  lastUpdate?: number;
}

/**
 * 投資目標類型
 * 表示用戶設定的財務目標
 */
export interface InvestmentGoal {
  // 唯一標識符
  id: string
  // 目標名稱
  name: string
  // 目標描述
  description?: string
  // 目標類型
  goalType: 'RETIREMENT' | 'HOME' | 'SAVINGS' | 'EDUCATION' | 'EMERGENCY' | 'OTHER'
  // 目標金額
  targetAmount: number
  // 當前已存金額（手動輸入）
  currentAmount: number
  // 截止日期時間戳（可選）
  deadline?: number
  // 每月計劃存入金額
  monthlyContribution: number
  // 關聯的投資組合 ID（自動追蹤市值）
  linkedPortfolioId?: string
  // 創建時間戳
  createdDate: number
  // 最後修改時間戳
  lastModified: number
  // 是否已完成
  isCompleted: boolean
  // 優先級
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

/**
 * Alpha Vantage OVERVIEW 端點返回的公司基本面數據
 */
export interface CompanyOverview {
  symbol: string
  name: string
  sector: string
  industry: string
  marketCap: number
  peRatio: number           // 本益比
  pegRatio: number          // 本益成長比
  roe: number               // 股東權益報酬率 (%)
  debtToEquity: number      // 負債股權比
  profitMargin: number      // 淨利潤率 (%)
  operatingMargin: number   // 營業利潤率 (%)
  revenueGrowthYOY: number  // 季度營收年增率 (%)
  earningsGrowthYOY: number // 季度盈利年增率 (%)
  dividendYield: number     // 股息率 (%)
  bookValue: number         // 每股帳面價值
  priceToBook: number       // 股價淨值比
  eps: number               // 每股盈餘
  currentRatio: number      // 流動比率
  // 技術面 & 市場定位
  week52High: number        // 52 週最高價
  week52Low: number         // 52 週最低價
  movingAvg50: number       // 50 日均線
  movingAvg200: number      // 200 日均線
  analystTargetPrice: number // 分析師共識目標價
}

/**
 * 單一買點訊號
 */
export interface BuySignal {
  id: string
  name: string
  triggered: boolean
  value: string
  detail: string
}

/**
 * 買點評估結果
 */
export interface BuySignalResult {
  impliedPrice: number
  signals: BuySignal[]
  triggeredCount: number
  verdict: 'STRONG_BUY' | 'CONSIDER' | 'WAIT' | 'AVOID'
  verdictText: string
}

/**
 * 巴菲特選股評分 - 單一指標結果
 */
export interface BuffettCriterion {
  name: string       // 指標名稱
  description: string
  value: number | null
  displayValue: string
  pass: boolean
  weight: number     // 滿分權重
  score: number      // 實際得分
  benchmark: string  // 標準說明
}

/**
 * 合理價格計算結果
 */
export interface FairValueResult {
  marketPrice: number
  // 三種估值法
  grahamNumber: number | null      // 葛拉漢公式：√(22.5 × EPS × 每股淨值)
  pegFairValue: number | null      // PEG=1 原則：EPS × 盈利成長率
  conservativeValue: number | null // 保守法：EPS × 15
  // 綜合合理價區間
  fairValueLow: number
  fairValueHigh: number
  fairValueMid: number
  // 判斷
  verdict: 'UNDERVALUED' | 'FAIR' | 'OVERVALUED' | 'EXPENSIVE'
  premiumDiscount: number          // 正=溢價%, 負=折價%
  suggestedBuyPrice: number        // 含 25% 安全邊際的建議買入價
  canCalculate: boolean            // 資料是否足夠
}

/**
 * 巴菲特選股分析結果
 */
export interface BuffettAnalysis {
  symbol: string
  name: string
  analyzedAt: number
  totalScore: number      // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID'
  criteria: BuffettCriterion[]
  summary: string
  moatStrength: 'WIDE' | 'NARROW' | 'NONE'  // 護城河強度
}

/**
 * API 響應類型
 * 用於 Alpha Vantage API 的單個響應項
 */
export interface StockApiResponse {
  // 符號
  symbol: string;
  // 名稱
  name: string;
  // 最新價格
  latestPrice: number;
  // 變化量
  change: number;
  // 變化百分比
  changePercent: number;
  // 市場資本化
  marketCap?: string;
  // P/E 比率
  peRatio?: string;
  // 股息收益率
  dividendYield?: string;
}
