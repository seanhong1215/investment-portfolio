/**
 * 巴菲特價值投資選股分析服務
 *
 * 根據巴菲特核心投資原則對股票進行評分：
 * 1. 高 ROE（股東權益報酬率）
 * 2. 低負債
 * 3. 穩定獲利能力（高利潤率）
 * 4. 合理本益比（不過高）
 * 5. 持續成長（盈利、營收）
 * 6. 護城河（品牌、競爭優勢）
 */

import { CompanyOverview, BuffettAnalysis, BuffettCriterion, FairValueResult, BuySignal, BuySignalResult } from '@/types'

/**
 * 安全邊際：得分 >= 某值才算通過
 */
function scoreCriterion(
  name: string,
  description: string,
  benchmark: string,
  weight: number,
  value: number | null,
  displayValue: string,
  scoreFn: (v: number) => number,  // 返回 0~1
): BuffettCriterion {
  const rawScore = value !== null ? scoreFn(value) : 0
  const score = Math.round(rawScore * weight)
  return {
    name,
    description,
    value,
    displayValue,
    pass: rawScore >= 0.6,
    weight,
    score,
    benchmark,
  }
}

/**
 * 線性插值：將 value 從 [low, high] 對應到 0~1
 * value >= high → 1, value <= low → 0
 */
function linearScale(value: number, low: number, high: number): number {
  if (value >= high) return 1
  if (value <= low) return 0
  return (value - low) / (high - low)
}

/**
 * 反向線性：value 越低越好 (例如 P/E 比)
 * value <= low → 1, value >= high → 0
 */
function reverseScale(value: number, low: number, high: number): number {
  if (value <= low) return 1
  if (value >= high) return 0
  return (high - value) / (high - low)
}

function fmt(v: number | null, suffix = '', decimals = 1): string {
  if (v === null || isNaN(v)) return 'N/A'
  return `${v.toFixed(decimals)}${suffix}`
}

/**
 * 計算護城河強度（基於利潤率、ROE 和市值）
 */
function calcMoat(o: CompanyOverview): 'WIDE' | 'NARROW' | 'NONE' {
  let score = 0
  if (o.profitMargin > 20) score++
  if (o.profitMargin > 30) score++
  if (o.roe > 20) score++
  if (o.roe > 30) score++
  if (o.marketCap > 50_000_000_000) score++ // 500 億美元以上
  if (score >= 4) return 'WIDE'
  if (score >= 2) return 'NARROW'
  return 'NONE'
}

/**
 * 主要分析函數：輸入公司基本面，輸出巴菲特評分
 */
export function analyzeBuffett(overview: CompanyOverview): BuffettAnalysis {
  const criteria: BuffettCriterion[] = [
    // 1. ROE ≥ 15%（核心指標，最高權重）
    scoreCriterion(
      '股東權益報酬率 (ROE)',
      '衡量公司利用股東資金創造利潤的效率。巴菲特偏好連續 ROE > 15% 的公司。',
      '≥ 15%（理想 > 20%）',
      25,
      overview.roe,
      fmt(overview.roe, '%'),
      (v) => linearScale(v, 5, 25),
    ),

    // 2. 負債股權比 < 0.5
    scoreCriterion(
      '負債股權比',
      '衡量公司財務槓桿。巴菲特偏好低負債、財務健全的企業。',
      '≤ 0.5（越低越好）',
      15,
      overview.debtToEquity,
      fmt(overview.debtToEquity, 'x', 2),
      (v) => reverseScale(v, 0.3, 1.5),
    ),

    // 3. 淨利潤率 > 15%
    scoreCriterion(
      '淨利潤率',
      '每 1 元營收轉化為利潤的比例。高利潤率代表競爭優勢（護城河）。',
      '≥ 15%（理想 > 20%）',
      20,
      overview.profitMargin,
      fmt(overview.profitMargin, '%'),
      (v) => linearScale(v, 5, 30),
    ),

    // 4. 本益比（P/E）合理
    scoreCriterion(
      '本益比 (P/E)',
      '股價相對盈利的估值。巴菲特重視「合理價格買好公司」，不追高估股票。',
      '5 ~ 25（過高估值有風險）',
      15,
      overview.peRatio > 0 ? overview.peRatio : null,
      overview.peRatio > 0 ? fmt(overview.peRatio, 'x') : 'N/A',
      (v) => {
        if (v <= 0) return 0
        if (v <= 25) return reverseScale(v, 5, 25) * 0.5 + 0.5  // 5-25 得 0.5~1
        return reverseScale(v, 25, 60)  // 25-60 得 0~1（遞減）
      },
    ),

    // 5. 盈利年增率
    scoreCriterion(
      '季度盈利年增率',
      '反映公司是否持續成長。巴菲特尋找盈利穩定增長的企業。',
      '≥ 10%（理想 > 20%）',
      15,
      overview.earningsGrowthYOY,
      fmt(overview.earningsGrowthYOY, '%'),
      (v) => linearScale(v, -5, 25),
    ),

    // 6. 流動比率（短期償債能力）
    scoreCriterion(
      '流動比率',
      '流動資產 / 流動負債。> 1.5 表示短期財務健康，不易陷入流動性危機。',
      '≥ 1.5',
      10,
      overview.currentRatio,
      fmt(overview.currentRatio, 'x', 2),
      (v) => linearScale(v, 0.8, 2.5),
    ),
  ]

  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0)
  const maxScore = criteria.reduce((sum, c) => sum + c.weight, 0)
  const normalizedScore = Math.round((totalScore / maxScore) * 100)

  const grade =
    normalizedScore >= 80 ? 'A' :
    normalizedScore >= 65 ? 'B' :
    normalizedScore >= 50 ? 'C' :
    normalizedScore >= 35 ? 'D' : 'F'

  const recommendation =
    normalizedScore >= 75 ? 'STRONG_BUY' :
    normalizedScore >= 60 ? 'BUY' :
    normalizedScore >= 45 ? 'HOLD' : 'AVOID'

  const moatStrength = calcMoat(overview)

  const passingCount = criteria.filter((c) => c.pass).length
  const summary = buildSummary(overview.name, normalizedScore, passingCount, criteria.length, moatStrength)

  return {
    symbol: overview.symbol,
    name: overview.name,
    analyzedAt: Date.now(),
    totalScore: normalizedScore,
    grade,
    recommendation,
    criteria,
    summary,
    moatStrength,
  }
}

/**
 * 買點評估：根據技術面 + 估值面多重訊號判斷是否為好的進場時機
 *
 * 使用 OVERVIEW 已有的數據，不需要額外 API：
 * - PEG 比率（成長 vs 估值）
 * - 52 週位置（價格在年度高低點的相對位置）
 * - 200 日均線關係（長期趨勢位置）
 * - 分析師共識目標空間
 * - 股息率保護
 *
 * 隱含現價 = P/E × EPS（避免額外 API 呼叫）
 */
export function calcBuySignals(overview: CompanyOverview): BuySignalResult {
  // 用 P/E × EPS 推算隱含現價（Alpha Vantage OVERVIEW 無直接現價）
  const impliedPrice =
    overview.peRatio > 0 && overview.eps > 0 ? overview.peRatio * overview.eps : 0

  const signals: BuySignal[] = []

  // ── 訊號 1：PEG 比率 ──
  if (overview.pegRatio > 0 && overview.pegRatio < 99) {
    const triggered = overview.pegRatio < 1.5
    signals.push({
      id: 'peg',
      name: 'PEG 比率（成長 vs 估值）',
      triggered,
      value: `${overview.pegRatio.toFixed(2)}x`,
      detail:
        overview.pegRatio < 1.0
          ? '成長速度遠超過估值，是強力買入訊號（PEG < 1）'
          : overview.pegRatio < 1.5
          ? '成長與估值匹配，為合理進場區間（PEG 1~1.5）'
          : overview.pegRatio < 2.5
          ? '估值略高於成長速度，建議等待回調（PEG 1.5~2.5）'
          : '估值明顯高於成長，不建議此價位進場（PEG > 2.5）',
    })
  }

  // ── 訊號 2：52 週位置 ──
  if (impliedPrice > 0 && overview.week52High > 0 && overview.week52Low > 0) {
    const range = overview.week52High - overview.week52Low
    const position = range > 0 ? ((impliedPrice - overview.week52Low) / range) * 100 : 50
    const triggered = position < 40
    signals.push({
      id: 'week52',
      name: '52 週價格位置',
      triggered,
      value: `年度低點起算 ${position.toFixed(0)}%`,
      detail:
        position < 25
          ? '接近 52 週低點，歷史上是絕佳買點（下方空間有限）'
          : position < 40
          ? '在年度下半段，相對低估區間'
          : position < 65
          ? '在年度中段，可觀察等待'
          : '接近 52 週高點，追高風險較大',
    })
  }

  // ── 訊號 3：相對 200 日均線 ──
  if (impliedPrice > 0 && overview.movingAvg200 > 0) {
    const diff = ((impliedPrice - overview.movingAvg200) / overview.movingAvg200) * 100
    const triggered = diff < 5  // 低於或接近均線都算機會
    signals.push({
      id: 'ma200',
      name: '相對 200 日均線',
      triggered,
      value: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`,
      detail:
        diff < -10
          ? '大幅低於長期均線，歷史上是價值投資者的黃金買點'
          : diff < 0
          ? '低於長期均線，長期趨勢轉弱，短期可能有買點'
          : diff < 10
          ? '略高於長期均線，可接受範圍'
          : '大幅高於均線，短期漲多需謹慎追高',
    })
  }

  // ── 訊號 4：分析師共識目標空間 ──
  if (impliedPrice > 0 && overview.analystTargetPrice > 0) {
    const upside = ((overview.analystTargetPrice - impliedPrice) / impliedPrice) * 100
    const triggered = upside > 15
    const upsideStr = upside >= 0 ? `+${upside.toFixed(1)}%` : `${upside.toFixed(1)}%`
    signals.push({
      id: 'analyst',
      name: '分析師共識目標空間',
      triggered,
      value: `${upsideStr}（目標 $${overview.analystTargetPrice.toFixed(2)}）`,
      detail:
        upside > 25
          ? `高盛、摩根等機構預測 12 個月目標價 $${overview.analystTargetPrice.toFixed(2)}，比現價 $${impliedPrice.toFixed(2)} 高 ${upsideStr}，機構普遍強力看漲`
          : upside > 15
          ? `機構預測 12 個月目標 $${overview.analystTargetPrice.toFixed(2)}，比現價 $${impliedPrice.toFixed(2)} 高 ${upsideStr}，仍有合理上漲空間`
          : upside > 0
          ? `機構預測 12 個月目標 $${overview.analystTargetPrice.toFixed(2)}，比現價 $${impliedPrice.toFixed(2)} 只高 ${upsideStr}，股價已接近機構認為的合理水位，空間有限`
          : `現價 $${impliedPrice.toFixed(2)} 已超過機構目標 $${overview.analystTargetPrice.toFixed(2)}，分析師認為目前高估`,
    })
  }

  // ── 訊號 5：股息率保護 ──
  if (overview.dividendYield > 0) {
    const triggered = overview.dividendYield >= 2
    signals.push({
      id: 'dividend',
      name: '股息率保護墊',
      triggered,
      value: `${overview.dividendYield.toFixed(2)}%`,
      detail:
        overview.dividendYield >= 4
          ? `高股息 ${overview.dividendYield.toFixed(2)}%，即使股價不漲也有豐厚被動收入`
          : overview.dividendYield >= 2
          ? `股息 ${overview.dividendYield.toFixed(2)}% 提供持有保護，降低等待成本`
          : `股息率偏低（${overview.dividendYield.toFixed(2)}%），主要靠資本利得`,
    })
  }

  const triggeredCount = signals.filter((s) => s.triggered).length
  const total = signals.length

  const verdict: BuySignalResult['verdict'] =
    triggeredCount >= Math.max(3, Math.ceil(total * 0.6)) ? 'STRONG_BUY' :
    triggeredCount >= 2                                    ? 'CONSIDER' :
    triggeredCount === 1                                   ? 'WAIT' :
    'AVOID'

  const verdictText: Record<BuySignalResult['verdict'], string> = {
    STRONG_BUY: `${triggeredCount}/${total} 個訊號觸發，是相對好的進場時機，可開始布局`,
    CONSIDER:   `${triggeredCount}/${total} 個訊號觸發，可以開始分批買入（建議先買 1/3）`,
    WAIT:       `${triggeredCount}/${total} 個訊號觸發，訊號尚不充分，建議繼續觀察`,
    AVOID:      `${triggeredCount}/${total} 個訊號觸發，目前不建議進場，等待訊號出現`,
  }

  return {
    impliedPrice,
    signals,
    triggeredCount,
    verdict,
    verdictText: verdictText[verdict],
  }
}

/**
 * 合理價格計算
 *
 * 三種估值法：
 * 1. 葛拉漢公式（Benjamin Graham）：√(22.5 × EPS × 每股淨值) — 保守底線
 * 2. PEG = 1 原則（Peter Lynch）：EPS × min(盈利成長率, 25) — 成長估值
 * 3. 保守 P/E 法：EPS × 15 — 穩健倍數
 *
 * 安全邊際：建議買入價 = 合理價中間值 × 75%（留 25% 緩衝）
 */
export function calcFairValue(overview: CompanyOverview, marketPrice: number): FairValueResult {
  const { eps, bookValue, earningsGrowthYOY } = overview

  // --- 三種估值法 ---
  const grahamNumber =
    eps > 0 && bookValue > 0
      ? Math.sqrt(22.5 * eps * bookValue)
      : null

  const pegFairValue =
    eps > 0 && earningsGrowthYOY > 2
      ? eps * Math.min(earningsGrowthYOY, 25)
      : null

  const conservativeValue = eps > 0 ? eps * 15 : null

  const estimates = [grahamNumber, pegFairValue, conservativeValue].filter(
    (v): v is number => v !== null && v > 0,
  )

  const canCalculate = estimates.length >= 1

  if (!canCalculate) {
    return {
      marketPrice,
      grahamNumber,
      pegFairValue,
      conservativeValue,
      fairValueLow: 0,
      fairValueHigh: 0,
      fairValueMid: 0,
      verdict: 'FAIR',
      premiumDiscount: 0,
      suggestedBuyPrice: 0,
      canCalculate: false,
    }
  }

  // 合理價區間：最低估值的 90% ~ 最高估值的 110%
  const fairValueLow = Math.min(...estimates) * 0.9
  const fairValueHigh = Math.max(...estimates) * 1.1
  const fairValueMid = estimates.reduce((a, b) => a + b, 0) / estimates.length

  // 溢價/折價比例（以中間值為基準）
  const premiumDiscount = ((marketPrice - fairValueMid) / fairValueMid) * 100

  const verdict: FairValueResult['verdict'] =
    premiumDiscount <= -20 ? 'UNDERVALUED' :
    premiumDiscount <= 15  ? 'FAIR' :
    premiumDiscount <= 40  ? 'OVERVALUED' :
    'EXPENSIVE'

  // 建議買入價：合理中間值打七五折（25% 安全邊際）
  const suggestedBuyPrice = fairValueMid * 0.75

  return {
    marketPrice,
    grahamNumber,
    pegFairValue,
    conservativeValue,
    fairValueLow,
    fairValueHigh,
    fairValueMid,
    verdict,
    premiumDiscount,
    suggestedBuyPrice,
    canCalculate,
  }
}

function buildSummary(
  name: string,
  score: number,
  passing: number,
  total: number,
  moat: 'WIDE' | 'NARROW' | 'NONE',
): string {
  const moatText = moat === 'WIDE' ? '具備寬護城河' : moat === 'NARROW' ? '具備窄護城河' : '護城河不明顯'
  return `${name} 通過 ${passing}/${total} 項巴菲特標準，綜合評分 ${score} 分。${moatText}。`
}
