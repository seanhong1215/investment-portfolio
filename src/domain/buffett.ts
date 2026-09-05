/**
 * 巴菲特價值投資選股分析 —— 純函數，不碰 React、不碰 I/O。
 *
 * 六項指標各有權重，加總 100：ROE 25、淨利率 20、負債股權比 15、
 * 本益比 15、盈餘年增率 15、流動比率 10。
 *
 * ## 為什麼要區分「缺資料」與「零分」
 *
 * 重構前這裡有一個會靜默污染所有結果的缺陷：adapter 層把 API 缺漏的欄位
 * 用 `parseFloat(x) || 0` 壓成 0，而 Alpha Vantage 的免費 OVERVIEW 端點
 * **根本不回傳 DebtToEquityRatio 與 CurrentRatio**。於是每一檔股票都變成
 *
 *   - 負債股權比 = 0 → `reverseScale(0, 0.3, 1.5)` = 1 → 固定拿滿 15 分
 *   - 流動比率   = 0 → `linearScale(0, 0.8, 2.5)`  = 0 → 固定拿 0 分
 *
 * 100 分裡有 25 分與公司體質完全無關，而且分數上限被壓到 90。
 * 諷刺的是評分函數原本就寫好了 `value === null` 的處理路徑，是 adapter
 * 在型別邊界上把「沒有資料」這個資訊丟掉了。
 *
 * 現在的做法：缺漏的指標**同時退出分子與分母**，分數在實際可評的權重上
 * 正規化；可評權重低於 MIN_RATABLE_WEIGHT 時不發布評級（NR），因為在
 * 半套資料上輸出「強力買進」比不輸出更糟。
 */

import type {
  BuffettAnalysis,
  BuffettCriterion,
  BuySignal,
  BuySignalResult,
  CompanyOverview,
  DataCompleteness,
  FairValueResult,
  Fundamental,
  PriceQuote,
} from '@/types'

/**
 * 低於這個可評權重就不給評級。
 *
 * 60 的理由：分數是在可評權重上正規化的，可評權重越低、單一指標對總分的
 * 槓桿越大 —— 只剩 40 分權重時，一項 25 分的 ROE 就佔了六成，分數會隨
 * 單一數字劇烈跳動，已經不具備與其他公司比較的意義。
 */
export const MIN_RATABLE_WEIGHT = 60

/**
 * 六項指標的權重，加總為 100。
 *
 * 匯出而非寫死在 buildCriteria 裡，是因為 UI 需要在使用者填表時即時算出
 * 「目前可評權重夠不夠發布評級」。同一組數字若在 UI 再抄一份，兩邊遲早
 * 會不一致，而不一致的症狀是「表單說可以分析、結果卻是 NR」。
 */
export const CRITERION_WEIGHTS = {
  roe: 25,
  profitMargin: 20,
  debtToEquity: 15,
  peRatio: 15,
  earningsGrowthYOY: 15,
  currentRatio: 10,
} as const

export type CriterionKey = keyof typeof CRITERION_WEIGHTS

/** 免責聲明。所有輸出評級或買賣訊號的畫面都必須顯示 */
export const DISCLAIMER =
  '本工具為個人技術作品，所有評分、估值與訊號皆由公開資料經固定規則計算，' +
  '僅供教育與研究用途，不構成任何投資建議或要約。投資決策請自行研究並自負風險。'

// ── 評分基礎 ──

/**
 * 線性插值：將 value 從 [low, high] 對應到 0~1。
 * value >= high → 1；value <= low → 0
 */
function linearScale(value: number, low: number, high: number): number {
  if (value >= high) return 1
  if (value <= low) return 0
  return (value - low) / (high - low)
}

/**
 * 反向線性：value 越低越好（例如負債股權比）。
 * value <= low → 1；value >= high → 0
 */
function reverseScale(value: number, low: number, high: number): number {
  if (value <= low) return 1
  if (value >= high) return 0
  return (high - value) / (high - low)
}

function fmt(v: Fundamental, suffix = '', decimals = 1): string {
  if (v === null || Number.isNaN(v)) return '無資料'
  return `${v.toFixed(decimals)}${suffix}`
}

interface CriterionSpec {
  name: string
  description: string
  benchmark: string
  weight: number
  value: Fundamental
  displayValue?: string
  /** 回傳 0~1。只有在 value 有效時才會被呼叫 */
  score: (v: number) => number
}

/**
 * 把一項指標的原始數值換算成得分。
 *
 * `available === false` 時得分為 0 **且不計入分母**，這是與「拿 0 分」
 * 的關鍵差異：一家沒有負債資料的公司不該因此被扣分，也不該因此被加分。
 */
function scoreCriterion(spec: CriterionSpec): BuffettCriterion {
  const available = spec.value !== null && Number.isFinite(spec.value)
  const rawScore = available ? spec.score(spec.value as number) : 0

  return {
    name: spec.name,
    description: spec.description,
    benchmark: spec.benchmark,
    weight: spec.weight,
    value: spec.value,
    displayValue: spec.displayValue ?? fmt(spec.value),
    available,
    pass: available && rawScore >= 0.6,
    score: Math.round(rawScore * spec.weight),
  }
}

/**
 * 護城河強度。
 *
 * 三項輸入全缺時回傳 UNKNOWN —— 「判斷不出護城河」與「沒有護城河」
 * 對投資判斷的意義完全不同，不能都顯示成「護城河不明顯」。
 */
function calcMoat(o: CompanyOverview): BuffettAnalysis['moatStrength'] {
  if ([o.profitMargin, o.roe, o.marketCap].every((v) => v === null)) return 'UNKNOWN'

  let score = 0
  if (o.profitMargin !== null) {
    if (o.profitMargin > 20) score++
    if (o.profitMargin > 30) score++
  }
  if (o.roe !== null) {
    if (o.roe > 20) score++
    if (o.roe > 30) score++
  }
  if (o.marketCap !== null && o.marketCap > 50_000_000_000) score++ // 500 億美元以上

  if (score >= 4) return 'WIDE'
  if (score >= 2) return 'NARROW'
  return 'NONE'
}

// ── 主分析 ──

function buildCriteria(o: CompanyOverview): BuffettCriterion[] {
  return [
    scoreCriterion({
      name: '股東權益報酬率 (ROE)',
      description: '衡量公司利用股東資金創造利潤的效率。巴菲特偏好連續 ROE > 15% 的公司。',
      benchmark: '≥ 15%（理想 > 20%）',
      weight: CRITERION_WEIGHTS.roe,
      value: o.roe,
      displayValue: fmt(o.roe, '%'),
      score: (v) => linearScale(v, 5, 25),
    }),

    scoreCriterion({
      name: '淨利潤率',
      description: '每 1 元營收轉化為利潤的比例。高利潤率代表競爭優勢（護城河）。',
      benchmark: '≥ 15%（理想 > 20%）',
      weight: CRITERION_WEIGHTS.profitMargin,
      value: o.profitMargin,
      displayValue: fmt(o.profitMargin, '%'),
      score: (v) => linearScale(v, 5, 30),
    }),

    scoreCriterion({
      name: '負債股權比',
      description: '衡量公司財務槓桿。巴菲特偏好低負債、財務健全的企業。',
      benchmark: '≤ 0.5（越低越好）',
      weight: CRITERION_WEIGHTS.debtToEquity,
      value: o.debtToEquity,
      displayValue: fmt(o.debtToEquity, 'x', 2),
      score: (v) => reverseScale(v, 0.3, 1.5),
    }),

    scoreCriterion({
      name: '本益比 (P/E)',
      description: '股價相對盈利的估值。巴菲特重視「合理價格買好公司」，不追高估股票。',
      benchmark: '5 ~ 25（過高估值有風險）',
      weight: CRITERION_WEIGHTS.peRatio,
      // P/E ≤ 0 代表公司虧損 —— 這是「有資料且不合格」，不是缺資料，
      // 所以保留數值讓它以 0 分計入分母，不能當成 null 排除掉。
      value: o.peRatio,
      displayValue:
        o.peRatio === null ? '無資料' : o.peRatio <= 0 ? '虧損（P/E 不適用）' : fmt(o.peRatio, 'x'),
      score: (v) => {
        if (v <= 0) return 0
        if (v <= 25) return reverseScale(v, 5, 25) * 0.5 + 0.5 // 5~25 得 0.5~1
        return reverseScale(v, 25, 60) // 25~60 遞減至 0
      },
    }),

    scoreCriterion({
      name: '季度盈利年增率',
      description: '反映公司是否持續成長。巴菲特尋找盈利穩定增長的企業。',
      benchmark: '≥ 10%（理想 > 20%）',
      weight: CRITERION_WEIGHTS.earningsGrowthYOY,
      value: o.earningsGrowthYOY,
      displayValue: fmt(o.earningsGrowthYOY, '%'),
      score: (v) => linearScale(v, -5, 25),
    }),

    scoreCriterion({
      name: '流動比率',
      description: '流動資產 / 流動負債。> 1.5 表示短期財務健康，不易陷入流動性危機。',
      benchmark: '≥ 1.5',
      weight: CRITERION_WEIGHTS.currentRatio,
      value: o.currentRatio,
      displayValue: fmt(o.currentRatio, 'x', 2),
      score: (v) => linearScale(v, 0.8, 2.5),
    }),
  ]
}

function assessCompleteness(criteria: BuffettCriterion[]): DataCompleteness {
  const availableWeight = criteria
    .filter((c) => c.available)
    .reduce((sum, c) => sum + c.weight, 0)

  return {
    availableWeight,
    missing: criteria.filter((c) => !c.available).map((c) => c.name),
    isRatable: availableWeight >= MIN_RATABLE_WEIGHT,
  }
}

/**
 * 主要分析函數：輸入公司基本面，輸出巴菲特評分。
 *
 * 分數在**實際可評的權重**上正規化，而非固定除以 100 —— 否則缺一項
 * 指標就等同於在那一項拿零分，資料越不完整的公司分數越低，
 * 而分數低的原因會被誤讀成「體質差」。
 */
export function analyzeBuffett(overview: CompanyOverview): BuffettAnalysis {
  const criteria = buildCriteria(overview)
  const completeness = assessCompleteness(criteria)

  const earned = criteria.reduce((sum, c) => sum + c.score, 0)
  const totalScore = completeness.isRatable
    ? Math.round((earned / completeness.availableWeight) * 100)
    : null

  const grade: BuffettAnalysis['grade'] =
    totalScore === null ? 'NR' :
    totalScore >= 80 ? 'A' :
    totalScore >= 65 ? 'B' :
    totalScore >= 50 ? 'C' :
    totalScore >= 35 ? 'D' : 'F'

  const recommendation: BuffettAnalysis['recommendation'] =
    totalScore === null ? 'INSUFFICIENT_DATA' :
    totalScore >= 75 ? 'STRONG_BUY' :
    totalScore >= 60 ? 'BUY' :
    totalScore >= 45 ? 'HOLD' : 'AVOID'

  const moatStrength = calcMoat(overview)

  return {
    symbol: overview.symbol,
    name: overview.name,
    source: overview.source,
    analyzedAt: Date.now(),
    totalScore,
    grade,
    recommendation,
    criteria,
    completeness,
    summary: buildSummary(overview.name, totalScore, criteria, completeness, moatStrength),
    moatStrength,
  }
}

function buildSummary(
  name: string,
  score: number | null,
  criteria: BuffettCriterion[],
  completeness: DataCompleteness,
  moat: BuffettAnalysis['moatStrength'],
): string {
  if (score === null) {
    return (
      `${name} 目前可評指標僅佔 ${completeness.availableWeight}/100 權重，` +
      `低於發布評級所需的 ${MIN_RATABLE_WEIGHT} 分門檻，因此不給出評級。` +
      `缺漏：${completeness.missing.join('、')}。可改用手動輸入補齊後再分析。`
    )
  }

  const ratable = criteria.filter((c) => c.available)
  const passing = ratable.filter((c) => c.pass).length
  const moatText =
    moat === 'WIDE' ? '具備寬護城河' :
    moat === 'NARROW' ? '具備窄護城河' :
    moat === 'NONE' ? '護城河不明顯' :
    '護城河無從判斷（缺少利潤率與 ROE）'

  const caveat =
    completeness.missing.length > 0 ? `（未納入：${completeness.missing.join('、')}）` : ''

  return `${name} 通過 ${passing}/${ratable.length} 項可評的巴菲特標準，綜合評分 ${score} 分${caveat}。${moatText}。`
}

// ── 價格 ──

/**
 * 由基本面反推價格：P/E × EPS。
 *
 * 這不是即時報價。P/E 與 EPS 都是 TTM 口徑，相乘得到的是「這份基本面快照
 * 對應的價格」，可能落後市價數日至一季。之所以仍然保留，是因為免費 API
 * 每日只有 25 次配額，為了取現價多打一次 GLOBAL_QUOTE 並不划算。
 *
 * 代價則用 `basis: 'derived'` 誠實標記出來，由 UI 顯示、由使用者判讀，
 * 而不是包裝成「現價」矇混過去。呼叫端若拿得到真實報價，應優先傳入。
 */
export function derivePrice(overview: CompanyOverview): PriceQuote | null {
  const { peRatio, eps } = overview
  if (peRatio === null || eps === null) return null
  if (peRatio <= 0 || eps <= 0) return null
  return { value: peRatio * eps, basis: 'derived' }
}

/** 有真實報價就用真實報價，否則退回推導價 */
export function resolvePrice(
  overview: CompanyOverview,
  marketPrice?: number | null,
): PriceQuote | null {
  if (marketPrice != null && marketPrice > 0) {
    return { value: marketPrice, basis: 'quote' }
  }
  return derivePrice(overview)
}

// ── 買點訊號 ──

/**
 * 買點評估：以估值面與相對位置的多重訊號判斷進場時機。
 *
 * 每個訊號都只在**它所需的資料齊全時**才被建立；缺資料的訊號不會以
 * 「未觸發」的形式出現，否則資料越少的股票看起來訊號越差。
 * 觸發門檻也因此改成佔實際可評訊號的比例，而非固定張數。
 */
export function calcBuySignals(
  overview: CompanyOverview,
  price: PriceQuote | null = derivePrice(overview),
): BuySignalResult {
  const signals: BuySignal[] = []
  const p = price?.value ?? 0

  // ── 訊號 1：PEG 比率 ──
  // 上限 99 是為了濾掉 Alpha Vantage 對極端成長率回傳的哨兵值
  if (overview.pegRatio !== null && overview.pegRatio > 0 && overview.pegRatio < 99) {
    const peg = overview.pegRatio
    signals.push({
      id: 'peg',
      name: 'PEG 比率（成長 vs 估值）',
      triggered: peg < 1.5,
      value: `${peg.toFixed(2)}x`,
      detail:
        peg < 1.0 ? '成長速度遠超過估值，是強力買入訊號（PEG < 1）' :
        peg < 1.5 ? '成長與估值匹配，為合理進場區間（PEG 1~1.5）' :
        peg < 2.5 ? '估值略高於成長速度，建議等待回調（PEG 1.5~2.5）' :
        '估值明顯高於成長，不建議此價位進場（PEG > 2.5）',
    })
  }

  // ── 訊號 2：52 週位置 ──
  if (
    p > 0 &&
    overview.week52High !== null &&
    overview.week52Low !== null &&
    overview.week52High > overview.week52Low
  ) {
    const range = overview.week52High - overview.week52Low
    const position = ((p - overview.week52Low) / range) * 100
    signals.push({
      id: 'week52',
      name: '52 週價格位置',
      triggered: position < 40,
      value: `年度低點起算 ${position.toFixed(0)}%`,
      detail:
        position < 25 ? '接近 52 週低點，下方空間相對有限' :
        position < 40 ? '在年度下半段，相對低估區間' :
        position < 65 ? '在年度中段，可觀察等待' :
        '接近 52 週高點，追高風險較大',
    })
  }

  // ── 訊號 3：相對 200 日均線 ──
  if (p > 0 && overview.movingAvg200 !== null && overview.movingAvg200 > 0) {
    const diff = ((p - overview.movingAvg200) / overview.movingAvg200) * 100
    signals.push({
      id: 'ma200',
      name: '相對 200 日均線',
      triggered: diff < 5, // 低於或貼近均線都算機會
      value: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`,
      detail:
        diff < -10 ? '大幅低於長期均線，價值投資者常視為進場區間' :
        diff < 0 ? '低於長期均線，長期趨勢轉弱，短期可能有買點' :
        diff < 10 ? '略高於長期均線，可接受範圍' :
        '大幅高於均線，短期漲多需謹慎追高',
    })
  }

  // ── 訊號 4：分析師共識目標空間 ──
  // Alpha Vantage 的 AnalystTargetPrice 是不具名的綜合共識，沒有任何機構
  // 歸屬資訊，因此描述文字**不得**指名任何一家投資銀行 —— 在金融產品的
  // 介面上替一個匿名數字掛上具體機構名稱，是不實陳述。
  if (p > 0 && overview.analystTargetPrice !== null && overview.analystTargetPrice > 0) {
    const target = overview.analystTargetPrice
    const upside = ((target - p) / p) * 100
    const upsideStr = `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`
    const basisNote = price?.basis === 'derived' ? '推導價' : '現價'

    signals.push({
      id: 'analyst',
      name: '分析師共識目標空間',
      triggered: upside > 15,
      value: `${upsideStr}（目標 $${target.toFixed(2)}）`,
      detail:
        upside > 25 ? `共識 12 個月目標價 $${target.toFixed(2)}，較${basisNote} $${p.toFixed(2)} 高 ${upsideStr}，分析師普遍看漲` :
        upside > 15 ? `共識 12 個月目標價 $${target.toFixed(2)}，較${basisNote} $${p.toFixed(2)} 高 ${upsideStr}，仍有上漲空間` :
        upside > 0 ? `共識 12 個月目標價 $${target.toFixed(2)}，較${basisNote} $${p.toFixed(2)} 僅高 ${upsideStr}，已接近共識合理水位` :
        `${basisNote} $${p.toFixed(2)} 已超過共識目標 $${target.toFixed(2)}，分析師認為目前偏高`,
    })
  }

  // ── 訊號 5：股息率保護 ──
  if (overview.dividendYield !== null && overview.dividendYield > 0) {
    const dy = overview.dividendYield
    signals.push({
      id: 'dividend',
      name: '股息率保護墊',
      triggered: dy >= 2,
      value: `${dy.toFixed(2)}%`,
      detail:
        dy >= 4 ? `高股息 ${dy.toFixed(2)}%，即使股價不漲仍有現金流入` :
        dy >= 2 ? `股息 ${dy.toFixed(2)}% 提供持有保護，降低等待成本` :
        `股息率偏低（${dy.toFixed(2)}%），報酬主要仰賴資本利得`,
    })
  }

  const total = signals.length
  const triggeredCount = signals.filter((s) => s.triggered).length

  // 少於 3 個可評訊號時不下結論 —— 只剩兩個訊號時「兩個都觸發」
  // 是樣本太小造成的假象，不是強力買點。
  if (total < 3) {
    return {
      price,
      signals,
      triggeredCount,
      verdict: 'INSUFFICIENT_DATA',
      verdictText:
        `可評估的訊號只有 ${total} 個，不足以判斷進場時機。` +
        '缺少 PEG、52 週高低、200 日均線或分析師目標價等資料。',
    }
  }

  const verdict: BuySignalResult['verdict'] =
    triggeredCount >= Math.ceil(total * 0.6) ? 'STRONG_BUY' :
    triggeredCount >= Math.ceil(total * 0.4) ? 'CONSIDER' :
    triggeredCount >= 1 ? 'WAIT' :
    'AVOID'

  const verdictText: Record<BuySignalResult['verdict'], string> = {
    STRONG_BUY: `${triggeredCount}/${total} 個訊號觸發，相對是較好的進場時機`,
    CONSIDER: `${triggeredCount}/${total} 個訊號觸發，可考慮分批布局`,
    WAIT: `${triggeredCount}/${total} 個訊號觸發，訊號尚不充分，建議繼續觀察`,
    AVOID: `${triggeredCount}/${total} 個訊號觸發，目前訊號全數未達標`,
    INSUFFICIENT_DATA: '',
  }

  return { price, signals, triggeredCount, verdict, verdictText: verdictText[verdict] }
}

// ── 合理價 ──

/**
 * 合理價格計算 —— 三種估值法取區間。
 *
 * 1. 葛拉漢公式（Benjamin Graham）：√(22.5 × EPS × 每股淨值) — 保守底線
 * 2. PEG = 1 原則（Peter Lynch）：EPS × min(盈餘成長率, 25) — 成長估值
 * 3. 保守 P/E 法：EPS × 15 — 穩健倍數
 *
 * 建議買入價 = 合理中間值 × 75%（保留 25% 安全邊際）。
 *
 * 溢折價需要一個比價基準；`price` 為 null 時仍會輸出合理價區間，但
 * verdict 為 NO_PRICE、premiumDiscount 為 null —— 沒有價格就沒有「貴或
 * 便宜」可言，這時給任何 verdict 都是編造出來的。
 */
export function calcFairValue(
  overview: CompanyOverview,
  price: PriceQuote | null = derivePrice(overview),
): FairValueResult {
  const { eps, bookValue, earningsGrowthYOY } = overview

  const grahamNumber =
    eps !== null && bookValue !== null && eps > 0 && bookValue > 0
      ? Math.sqrt(22.5 * eps * bookValue)
      : null

  const pegFairValue =
    eps !== null && earningsGrowthYOY !== null && eps > 0 && earningsGrowthYOY > 2
      ? eps * Math.min(earningsGrowthYOY, 25)
      : null

  const conservativeValue = eps !== null && eps > 0 ? eps * 15 : null

  const estimates = [grahamNumber, pegFairValue, conservativeValue].filter(
    (v): v is number => v !== null && v > 0,
  )

  if (estimates.length === 0) {
    return {
      price,
      grahamNumber: null,
      pegFairValue: null,
      conservativeValue: null,
      fairValueLow: 0,
      fairValueHigh: 0,
      fairValueMid: 0,
      verdict: 'NO_PRICE',
      premiumDiscount: null,
      suggestedBuyPrice: 0,
      canCalculate: false,
    }
  }

  // 合理價區間：最低估值的 90% ~ 最高估值的 110%
  const fairValueMid = estimates.reduce((a, b) => a + b, 0) / estimates.length
  const base = {
    price,
    grahamNumber,
    pegFairValue,
    conservativeValue,
    fairValueLow: Math.min(...estimates) * 0.9,
    fairValueHigh: Math.max(...estimates) * 1.1,
    fairValueMid,
    suggestedBuyPrice: fairValueMid * 0.75,
    canCalculate: true,
  }

  if (price === null || price.value <= 0) {
    return { ...base, verdict: 'NO_PRICE', premiumDiscount: null }
  }

  const premiumDiscount = ((price.value - fairValueMid) / fairValueMid) * 100
  const verdict: FairValueResult['verdict'] =
    premiumDiscount <= -20 ? 'UNDERVALUED' :
    premiumDiscount <= 15 ? 'FAIR' :
    premiumDiscount <= 40 ? 'OVERVALUED' :
    'EXPENSIVE'

  return { ...base, verdict, premiumDiscount }
}
