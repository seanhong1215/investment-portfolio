/**
 * 投資組合顧問服務
 *
 * 根據投資人輪廓（目標、年限、風險）產生專屬的投資組合建議
 * 包含 ETF 核心配置、個股衛星配置、買點策略
 */

// ===== 類型定義 =====

export type InvestGoal = 'RETIREMENT' | 'HOME' | 'FREEDOM' | 'EDUCATION' | 'EMERGENCY'
export type TimeHorizon = 'SHORT' | 'MEDIUM' | 'LONG' | 'VERY_LONG'
export type RiskLevel   = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'

export interface InvestorProfile {
  goal: InvestGoal
  timeHorizon: TimeHorizon
  riskLevel: RiskLevel
  monthlyContribution: number
  currentSavings: number
}

export interface AllocationItem {
  symbol: string
  name: string
  percentage: number
  type: 'ETF' | 'STOCK'
  reason: string
}

export interface BuyStrategy {
  etfRule: string
  stockRule: string
  triggers: string[]
}

export interface PortfolioRecommendation {
  title: string
  description: string
  etfCore: AllocationItem[]
  stockSatellite: AllocationItem[]
  expectedReturnMin: number   // 年化 %
  expectedReturnMax: number
  buyStrategy: BuyStrategy
  projections: {
    year5: number
    year10: number
    year20: number
  }
  warningNote: string
}

// ===== 投影計算 =====

/**
 * 未來價值：FV = PV*(1+r)^n + PMT*((1+r)^n-1)/r（月複利）
 *
 * 匯出是為了讓 r = 0 那條分支能被直接測到。年化 0% 在目前的
 * RETURN_RANGE 下走不到，但公式本身在 r = 0 時會除以零得出 NaN，
 * 那是屬於這個函式的邊界，該由測試守住而不是靠呼叫端剛好不觸發。
 *
 * @param annualRate 年化報酬率 %（例如 7 代表 7%）
 */
export function projectFV(pv: number, monthly: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12
  const n = years * 12
  if (r === 0) return pv + monthly * n
  return pv * Math.pow(1 + r, n) + monthly * (Math.pow(1 + r, n) - 1) / r
}

// ===== 配置模板 =====

interface SymbolInfo {
  name: string
  reason: string
}

/**
 * `as const satisfies` 而非 `Record<string, …>`：前者讓 key 成為字面量聯集，
 * 查表因此是**完全的**，不需要 `?.` 或 `?? fallback`。
 *
 * 這不只是少寫幾個字 —— 原本 `ETF_INFO[sym]?.name ?? sym` 的 fallback 永遠
 * 不會執行（sym 全部來自 ALLOCATION_MAP），它唯一的作用是在有人往
 * ALLOCATION_MAP 加入未登錄的代碼時，讓畫面**悄悄**顯示裸代碼 + 空白理由。
 * 改成字面量聯集後，同樣的錯誤會變成編譯錯誤。
 */
const ETF_INFO = {
  VOO:  { name: 'Vanguard S&P 500',       reason: '追蹤美國前 500 大企業，長期年化約 10%，核心基石' },
  QQQ:  { name: 'Nasdaq 100',             reason: '科技成長導向，適合長期持有追求高報酬' },
  VTI:  { name: 'Vanguard 全美股市',       reason: '涵蓋美國全市場 3,700+ 支股票，最分散' },
  VXUS: { name: 'Vanguard 國際股市',       reason: '分散至美國以外市場，降低單一市場風險' },
  BND:  { name: 'Vanguard 全債市',         reason: '穩定配息，波動小，短期目標或保守配置的壓艙石' },
  VGSH: { name: 'Vanguard 短期公債',       reason: '短期低風險，適合 1-3 年目標的防禦性配置' },
  VYM:  { name: 'Vanguard 高股息',         reason: '穩定股息收入，適合需要現金流的投資人' },
  SCHD: { name: 'Schwab 股息精選',         reason: '嚴選高品質股息股，歷史股息成長穩健' },
} as const satisfies Record<string, SymbolInfo>

type EtfSymbol = keyof typeof ETF_INFO

const STOCK_INFO = {
  MSFT: { name: 'Microsoft',    reason: '雲端（Azure）+ AI（Copilot），護城河極寬，ROE 持續 > 35%' },
  AAPL: { name: 'Apple',        reason: '品牌護城河 + 生態系鎖定，自由現金流豐沛' },
  GOOGL: { name: 'Alphabet',   reason: '廣告 + 雲端（GCP）+ AI，估值相對合理' },
  JNJ:  { name: 'Johnson & Johnson', reason: '醫療護城河，連續 60+ 年股息成長（股息貴族）' },
  KO:   { name: 'Coca-Cola',    reason: '巴菲特最愛，品牌護城河極寬，穩定股息 60+ 年' },
  PG:   { name: 'Procter & Gamble', reason: '消費必需品護城河，股息貴族，防禦性強' },
  NVDA: { name: 'Nvidia',       reason: 'AI 算力核心，成長爆發性強，適合積極型長期持有' },
  JPM:  { name: 'JPMorgan',     reason: '全球最大銀行之一，ROE 穩健，金融護城河' },
} as const satisfies Record<string, SymbolInfo>

type StockSymbol = keyof typeof STOCK_INFO

// ===== 核心推薦邏輯 =====

type Key = `${RiskLevel}_${TimeHorizon}`

const ALLOCATION_MAP: Record<Key, { etf: [EtfSymbol, number][]; stock: [StockSymbol, number][] }> = {
  // 保守 × 短期 (<3年)：以債券為主，不建議個股
  CONSERVATIVE_SHORT: {
    etf: [['VGSH', 40], ['BND', 35], ['VOO', 25]],
    stock: [],
  },
  // 保守 × 中期 (3-5年)
  CONSERVATIVE_MEDIUM: {
    etf: [['VOO', 40], ['BND', 30], ['VXUS', 15], ['VYM', 15]],
    stock: [],
  },
  // 保守 × 長期 (5-10年)
  CONSERVATIVE_LONG: {
    etf: [['VOO', 50], ['VXUS', 20], ['BND', 15], ['VYM', 10]],
    stock: [['KO', 3], ['JNJ', 2]],
  },
  // 保守 × 超長期 (>10年)
  CONSERVATIVE_VERY_LONG: {
    etf: [['VOO', 55], ['VXUS', 20], ['VYM', 15]],
    stock: [['KO', 5], ['JNJ', 5]],
  },

  // 平衡 × 短期
  BALANCED_SHORT: {
    etf: [['BND', 40], ['VOO', 40], ['VXUS', 20]],
    stock: [],
  },
  // 平衡 × 中期
  BALANCED_MEDIUM: {
    etf: [['VOO', 40], ['QQQ', 20], ['VXUS', 15], ['BND', 10]],
    stock: [['MSFT', 8], ['AAPL', 7]],
  },
  // 平衡 × 長期
  BALANCED_LONG: {
    etf: [['VOO', 45], ['QQQ', 20], ['VXUS', 15]],
    stock: [['MSFT', 8], ['AAPL', 7], ['GOOGL', 5]],
  },
  // 平衡 × 超長期
  BALANCED_VERY_LONG: {
    etf: [['VOO', 40], ['QQQ', 20], ['VXUS', 10]],
    stock: [['MSFT', 10], ['AAPL', 8], ['GOOGL', 7], ['JNJ', 5]],
  },

  // 積極 × 短期
  AGGRESSIVE_SHORT: {
    etf: [['BND', 30], ['VOO', 40], ['QQQ', 30]],
    stock: [],
  },
  // 積極 × 中期
  AGGRESSIVE_MEDIUM: {
    etf: [['VOO', 35], ['QQQ', 30], ['VXUS', 10]],
    stock: [['MSFT', 10], ['NVDA', 8], ['GOOGL', 7]],
  },
  // 積極 × 長期
  AGGRESSIVE_LONG: {
    etf: [['VOO', 30], ['QQQ', 25], ['VXUS', 10]],
    stock: [['MSFT', 12], ['NVDA', 10], ['GOOGL', 8], ['AAPL', 5]],
  },
  // 積極 × 超長期
  AGGRESSIVE_VERY_LONG: {
    etf: [['VOO', 25], ['QQQ', 25]],
    stock: [['MSFT', 15], ['NVDA', 12], ['GOOGL', 10], ['AAPL', 8], ['JPM', 5]],
  },
}

const RETURN_RANGE: Record<RiskLevel, [number, number]> = {
  CONSERVATIVE: [5, 7],
  BALANCED:     [7, 9],
  AGGRESSIVE:   [9, 12],
}

const BUY_STRATEGY_MAP: Record<Key, BuyStrategy> = {
  CONSERVATIVE_SHORT: {
    etfRule: '每月固定日（如每月5日）定期定額，不需擇時',
    stockRule: '不建議配置個股，目標太近不適合承擔波動',
    triggers: ['直接 DCA，無需等待買點'],
  },
  CONSERVATIVE_MEDIUM: {
    etfRule: '每月定期定額 VOO + BND，比例固定',
    stockRule: '暫不配置個股，待市值穩定後再考慮',
    triggers: ['每月定額 ETF', '年底再平衡一次比例'],
  },
  CONSERVATIVE_LONG: {
    etfRule: '每月定期定額核心 ETF（VOO + VXUS）',
    stockRule: '個股採 GARP 標準：巴菲特評分 ≥ 60 且 P/E < 歷史均值',
    triggers: [
      '個股下跌 10% 以上時考慮加碼',
      '大盤恐慌時（VIX > 30）增加買入',
      '股息貴族跌破歷史低估值時進場',
    ],
  },
  CONSERVATIVE_VERY_LONG: {
    etfRule: '每月定期定額 VOO + VXUS，長期不停歇',
    stockRule: '個股等待合理價：KO / JNJ 股息率高於歷史均值時進場',
    triggers: [
      '股息率 > 歷史平均 + 0.5% 時買入',
      '大盤修正 15% 以上時加碼',
    ],
  },
  BALANCED_SHORT: {
    etfRule: '每月定期定額，BND 為主壓艙',
    stockRule: '不配置個股',
    triggers: ['每月定額，不擇時'],
  },
  BALANCED_MEDIUM: {
    etfRule: '每月定期定額 VOO + QQQ，比例 2:1',
    stockRule: '個股（MSFT/AAPL）等 P/E 回落至歷史均值以下時分批買入',
    triggers: [
      '個股 P/E < 3 年歷史均值 × 0.9 時',
      '股價從高點回落 ≥ 10%',
      '巴菲特評分 ≥ 65 分',
    ],
  },
  BALANCED_LONG: {
    etfRule: '每月定期定額 VOO + QQQ，長期持有不停歇',
    stockRule: '三條件同時觸發才買個股：評分 ≥ 65、P/E 低於均值、股價回調 ≥ 10%',
    triggers: [
      '巴菲特評分 ≥ 65',
      '股價從近期高點回落 ≥ 10%',
      '市場 P/E < 20（整體不過熱）',
    ],
  },
  BALANCED_VERY_LONG: {
    etfRule: '每月定期定額 VOO（長期核心），年底檢視比例',
    stockRule: '個股採巴菲特標準：ROE > 15%、低負債、護城河，等待 GARP 價格',
    triggers: [
      '巴菲特評分 ≥ 70',
      '股價低於 PEG 合理價',
      '年度財報優異但股價未反應時',
    ],
  },
  AGGRESSIVE_SHORT: {
    etfRule: '每月定期定額，BND 做緩衝',
    stockRule: '不配置個股，時間太短不適合',
    triggers: ['每月定額，不擇時'],
  },
  AGGRESSIVE_MEDIUM: {
    etfRule: '每月定期定額 VOO + QQQ，比例 1:1',
    stockRule: 'AI/科技個股（NVDA/MSFT）等法說會後下跌機會進場',
    triggers: [
      '法說會後股價下跌 ≥ 8% 但基本面未變',
      '大盤修正 ≥ 10%',
      '個股巴菲特評分 ≥ 60',
    ],
  },
  AGGRESSIVE_LONG: {
    etfRule: '每月定期定額 VOO + QQQ 作為基底',
    stockRule: '個股積極布局：等市場恐慌、法說會後利空出盡進場',
    triggers: [
      '大盤跌 ≥ 15%（大機會）',
      '個股從高點回落 ≥ 20%',
      '巴菲特評分 ≥ 60 + 護城河存在',
    ],
  },
  AGGRESSIVE_VERY_LONG: {
    etfRule: '每月定期定額 VOO 為核心基底，長期不中斷',
    stockRule: '精選 5-7 支巴菲特等級個股，等市場低估時重倉進場',
    triggers: [
      '巴菲特評分 ≥ 70 + 護城河寬',
      '股價低於葛拉漢公式合理價 × 0.9',
      '整體市場恐慌（大盤跌 ≥ 20%）',
      '年報顯示盈利超預期但股價未漲',
    ],
  },
}

const TITLE_MAP: Record<Key, string> = {
  CONSERVATIVE_SHORT:     '短期防守型',
  CONSERVATIVE_MEDIUM:    '穩健儲蓄型',
  CONSERVATIVE_LONG:      '保守長線型',
  CONSERVATIVE_VERY_LONG: '保守複利型',
  BALANCED_SHORT:         '短期均衡型',
  BALANCED_MEDIUM:        '核心衛星型',
  BALANCED_LONG:          '均衡成長型',
  BALANCED_VERY_LONG:     '巴菲特均衡型',
  AGGRESSIVE_SHORT:       '短期衝刺型',
  AGGRESSIVE_MEDIUM:      '成長衝刺型',
  AGGRESSIVE_LONG:        '積極成長型',
  AGGRESSIVE_VERY_LONG:   '巴菲特精選型',
}

const WARNING_MAP: Record<RiskLevel, string> & { SHORT: string } = {
  CONSERVATIVE: '保守配置降低波動，但長期報酬也相對有限。',
  BALANCED: '均衡配置適合大多數人，建議至少持有 5 年以上發揮複利效果。',
  AGGRESSIVE: '積極配置可能短期虧損 30-40%，需要強大的心理承受力。請確認不會在下跌時賣出。',
  SHORT: '短期目標（< 3 年）不建議重壓股票，波動可能導致在需要用錢時虧損。',
}

// ===== 主要匯出函式 =====

export function getRecommendation(profile: InvestorProfile): PortfolioRecommendation {
  const key: Key = `${profile.riskLevel}_${profile.timeHorizon}`
  const alloc = ALLOCATION_MAP[key]
  const [retMin, retMax] = RETURN_RANGE[profile.riskLevel]
  const strategy = BUY_STRATEGY_MAP[key]

  const midReturn = (retMin + retMax) / 2

  // 查表都是完全的（key 是字面量聯集），因此不需要 fallback。
  // 加入未登錄的代碼會是編譯錯誤，而不是執行時悄悄顯示裸代碼。
  const etfCore: AllocationItem[] = alloc.etf.map(([sym, pct]) => ({
    symbol: sym,
    name: ETF_INFO[sym].name,
    percentage: pct,
    type: 'ETF',
    reason: ETF_INFO[sym].reason,
  }))

  const stockSatellite: AllocationItem[] = alloc.stock.map(([sym, pct]) => ({
    symbol: sym,
    name: STOCK_INFO[sym].name,
    percentage: pct,
    type: 'STOCK',
    reason: STOCK_INFO[sym].reason,
  }))

  const warning =
    profile.timeHorizon === 'SHORT' ? WARNING_MAP.SHORT : WARNING_MAP[profile.riskLevel]

  return {
    title: TITLE_MAP[key],
    description: `依據您的目標與風險偏好，為您推薦「${TITLE_MAP[key]}」配置。`,
    etfCore,
    stockSatellite,
    expectedReturnMin: retMin,
    expectedReturnMax: retMax,
    buyStrategy: strategy,
    projections: {
      year5:  Math.round(projectFV(profile.currentSavings, profile.monthlyContribution, midReturn, 5)),
      year10: Math.round(projectFV(profile.currentSavings, profile.monthlyContribution, midReturn, 10)),
      year20: Math.round(projectFV(profile.currentSavings, profile.monthlyContribution, midReturn, 20)),
    },
    warningNote: warning,
  }
}

// ===== 輔助資訊 =====
// 這裡只放文字。圖示屬於呈現層，由頁面自行對應 lucide icon —
// 領域層混入 emoji 會讓它被綁死在特定的 UI 呈現方式上。

export const GOAL_INFO: Record<InvestGoal, { label: string; hint: string }> = {
  RETIREMENT: { label: '退休準備',   hint: '打造退休後的穩定現金流' },
  HOME:       { label: '購屋頭期款', hint: '累積足夠的房屋頭期款' },
  FREEDOM:    { label: '財務自由',   hint: '讓被動收入超過生活支出' },
  EDUCATION:  { label: '子女教育',   hint: '為子女的教育費用做準備' },
  EMERGENCY:  { label: '緊急備用金', hint: '建立 6-12 個月的生活費緩衝' },
}

export const TIME_INFO: Record<TimeHorizon, { label: string }> = {
  SHORT:     { label: '1 ~ 3 年' },
  MEDIUM:    { label: '3 ~ 5 年' },
  LONG:      { label: '5 ~ 10 年' },
  VERY_LONG: { label: '10 年以上' },
}

export const RISK_INFO: Record<RiskLevel, { label: string; desc: string }> = {
  CONSERVATIVE: { label: '保守', desc: '接受較低報酬，避免大幅波動。市場下跌 20% 時會非常不安。' },
  BALANCED:     { label: '平衡', desc: '接受適度波動換取合理報酬。市場下跌能持有，但超過 30% 會考慮調整。' },
  AGGRESSIVE:   { label: '積極', desc: '接受大幅波動換取長期高報酬。市場下跌 40% 仍能堅定持有甚至加碼。' },
}
