import { describe, it, expect } from 'vitest'
import {
  analyzeBuffett,
  calcFairValue,
  calcBuySignals,
  derivePrice,
  resolvePrice,
  CRITERION_WEIGHTS,
  MIN_RATABLE_WEIGHT,
} from './buffett'
import { makeOverview } from './testFactories'
import type { PriceQuote } from '@/types'

/** 測試用的即時報價，讓「價格從哪來」在測試裡也是明寫的 */
const quote = (value: number): PriceQuote => ({ value, basis: 'quote' })

describe('analyzeBuffett', () => {
  it('評分落在 0 ~ 100', () => {
    const strong = analyzeBuffett(makeOverview({ roe: 45, debtToEquity: 0.2, profitMargin: 35 }))
    const weak = analyzeBuffett(
      makeOverview({ roe: -10, debtToEquity: 5, profitMargin: -5, peRatio: 0, earningsGrowthYOY: -30, currentRatio: 0.3 })
    )

    expect(strong.totalScore).toBeLessThanOrEqual(100)
    expect(weak.totalScore).toBeGreaterThanOrEqual(0)
    expect(strong.totalScore!).toBeGreaterThan(weak.totalScore!)
  })

  it('優質企業拿到高評級與買進建議', () => {
    const result = analyzeBuffett(
      makeOverview({ roe: 35, debtToEquity: 0.3, profitMargin: 30, peRatio: 18, earningsGrowthYOY: 20, currentRatio: 2.0 })
    )

    expect(result.totalScore!).toBeGreaterThanOrEqual(75)
    expect(result.grade).toBe('A')
    expect(result.recommendation).toBe('STRONG_BUY')
  })

  it('體質差的企業被建議迴避', () => {
    const result = analyzeBuffett(
      makeOverview({ roe: 2, debtToEquity: 4, profitMargin: 1, peRatio: 80, earningsGrowthYOY: -20, currentRatio: 0.5 })
    )

    expect(result.grade).toBe('F')
    expect(result.recommendation).toBe('AVOID')
  })

  it('六項指標的權重總和為 100（評分才具可比性）', () => {
    const { criteria } = analyzeBuffett(makeOverview())
    expect(criteria.reduce((sum, c) => sum + c.weight, 0)).toBe(100)
  })

  it('匯出的權重表與實際計分用的權重一致', () => {
    // UI 用 CRITERION_WEIGHTS 判斷「填夠了沒」，兩邊不一致會讓表單說可以
    // 分析、結果卻是 NR。
    const { criteria } = analyzeBuffett(makeOverview())
    const exported = Object.values(CRITERION_WEIGHTS).reduce((a, b) => a + b, 0)

    expect(criteria.reduce((sum, c) => sum + c.weight, 0)).toBe(exported)
  })

  it('每項得分不超過該項權重', () => {
    const { criteria } = analyzeBuffett(makeOverview({ roe: 99, profitMargin: 99, currentRatio: 99 }))
    for (const c of criteria) {
      expect(c.score).toBeLessThanOrEqual(c.weight)
      expect(c.score).toBeGreaterThanOrEqual(0)
    }
  })

  it('P/E 為 0 或負值（虧損企業）視為有資料但不合格，仍計入分母', () => {
    // 虧損是一個事實，不是資料缺漏 —— 它必須被扣分，不能被排除。
    const { criteria, completeness } = analyzeBuffett(makeOverview({ peRatio: 0 }))
    const pe = criteria.find((c) => c.name.includes('本益比'))!

    expect(pe.available).toBe(true)
    expect(pe.score).toBe(0)
    expect(pe.pass).toBe(false)
    expect(completeness.availableWeight).toBe(100)
  })

  it('高利潤率 + 高 ROE + 大市值 → 寬護城河', () => {
    const result = analyzeBuffett(
      makeOverview({ profitMargin: 35, roe: 35, marketCap: 100_000_000_000 })
    )
    expect(result.moatStrength).toBe('WIDE')
  })

  it('平庸的獲利能力 → 沒有護城河', () => {
    const result = analyzeBuffett(
      makeOverview({ profitMargin: 5, roe: 8, marketCap: 1_000_000_000 })
    )
    expect(result.moatStrength).toBe('NONE')
  })

  it('護城河所需指標全缺 → UNKNOWN，不等於「沒有護城河」', () => {
    const result = analyzeBuffett(
      makeOverview({ profitMargin: null, roe: null, marketCap: null })
    )
    expect(result.moatStrength).toBe('UNKNOWN')
  })
})

/**
 * 這一組是這次重構的核心迴歸測試。
 *
 * 缺陷原貌：Alpha Vantage 免費 OVERVIEW 不回傳 DebtToEquityRatio 與
 * CurrentRatio，而舊 adapter 把缺漏值換成 0，於是每一檔股票的負債項
 * 恆拿滿 15 分、流動比率項恆拿 0 分 —— 25 分權重與公司體質無關。
 */
describe('analyzeBuffett — 缺資料與零分是兩件事', () => {
  it('缺漏的指標不計入分子，也不計入分母', () => {
    const complete = analyzeBuffett(makeOverview())
    const missingTwo = analyzeBuffett(makeOverview({ debtToEquity: null, currentRatio: null }))

    expect(complete.completeness.availableWeight).toBe(100)
    expect(missingTwo.completeness.availableWeight).toBe(
      100 - CRITERION_WEIGHTS.debtToEquity - CRITERION_WEIGHTS.currentRatio,
    )
    expect(missingTwo.completeness.missing).toEqual(['負債股權比', '流動比率'])
  })

  it('缺負債資料不會被當成「零負債」而白拿滿分', () => {
    // 舊行為：debtToEquity 缺漏 → 0 → reverseScale(0, 0.3, 1.5) = 1 → 滿分
    const missing = analyzeBuffett(makeOverview({ debtToEquity: null }))
    const debtFree = analyzeBuffett(makeOverview({ debtToEquity: 0 }))

    const debtOf = (r: typeof missing) => r.criteria.find((c) => c.name === '負債股權比')!

    expect(debtOf(missing).available).toBe(false)
    expect(debtOf(missing).score).toBe(0)
    expect(debtOf(debtFree).available).toBe(true)
    expect(debtOf(debtFree).score).toBe(CRITERION_WEIGHTS.debtToEquity)
  })

  it('缺流動比率資料不會被當成 0 倍而白白扣分', () => {
    const base = makeOverview({ roe: 30, profitMargin: 28, debtToEquity: 0.3, peRatio: 15, earningsGrowthYOY: 22 })
    const missing = analyzeBuffett({ ...base, currentRatio: null })
    const genuinelyBad = analyzeBuffett({ ...base, currentRatio: 0.3 })

    // 舊行為下這兩者完全相同（缺漏被壓成 0，等同於流動比率 0.3 的體質）。
    // 現在「不知道」必須明顯優於「知道它很糟」。
    expect(missing.totalScore!).toBeGreaterThan(genuinelyBad.totalScore!)
    expect(genuinelyBad.criteria.find((c) => c.name === '流動比率')!.score).toBe(0)
  })

  it('缺漏項的分數 = 其餘各項在縮小後分母上的正規化結果', () => {
    const overview = makeOverview({
      roe: 30, profitMargin: 28, debtToEquity: 0.3, peRatio: 15, earningsGrowthYOY: 22,
      currentRatio: null,
    })
    const result = analyzeBuffett(overview)
    const earned = result.criteria.reduce((sum, c) => sum + c.score, 0)

    expect(result.completeness.availableWeight).toBe(100 - CRITERION_WEIGHTS.currentRatio)
    expect(result.totalScore).toBe(Math.round((earned / result.completeness.availableWeight) * 100))
  })

  it('可評權重不足時不發布評級，而不是給一個算在半套資料上的分數', () => {
    const sparse = analyzeBuffett(
      makeOverview({ profitMargin: null, debtToEquity: null, peRatio: null, currentRatio: null })
    )

    expect(sparse.completeness.availableWeight).toBeLessThan(MIN_RATABLE_WEIGHT)
    expect(sparse.completeness.isRatable).toBe(false)
    expect(sparse.totalScore).toBeNull()
    expect(sparse.grade).toBe('NR')
    expect(sparse.recommendation).toBe('INSUFFICIENT_DATA')
  })

  it('剛好達到門檻時給評級（邊界值本身算通過）', () => {
    // ROE 25 + 淨利率 20 + 負債 15 = 60 = MIN_RATABLE_WEIGHT
    const atThreshold = analyzeBuffett(
      makeOverview({ peRatio: null, earningsGrowthYOY: null, currentRatio: null })
    )

    expect(atThreshold.completeness.availableWeight).toBe(MIN_RATABLE_WEIGHT)
    expect(atThreshold.totalScore).not.toBeNull()
    expect(atThreshold.grade).not.toBe('NR')
  })

  it('未評級的摘要要說清楚缺了什麼，不能只說「分數不足」', () => {
    const sparse = analyzeBuffett(
      makeOverview({ profitMargin: null, debtToEquity: null, peRatio: null, currentRatio: null })
    )

    expect(sparse.summary).toContain('淨利潤率')
    expect(sparse.summary).toContain(String(MIN_RATABLE_WEIGHT))
  })

  it('分數是在可評權重上正規化，不是固定除以 100', () => {
    // 全部拿滿分但缺兩項 → 仍應是 100 分，而非 (100-25)/100 = 75 分
    const perfect = analyzeBuffett(
      makeOverview({
        roe: 50, profitMargin: 50, peRatio: 5, earningsGrowthYOY: 50,
        debtToEquity: null, currentRatio: null,
      })
    )

    expect(perfect.totalScore).toBe(100)
  })
})

describe('derivePrice / resolvePrice', () => {
  it('推導價 = P/E × EPS，並標記為 derived', () => {
    expect(derivePrice(makeOverview({ peRatio: 20, eps: 3 }))).toEqual({ value: 60, basis: 'derived' })
  })

  it('P/E 或 EPS 缺失、為零或為負時無法推導', () => {
    expect(derivePrice(makeOverview({ peRatio: null }))).toBeNull()
    expect(derivePrice(makeOverview({ eps: null }))).toBeNull()
    expect(derivePrice(makeOverview({ peRatio: 0 }))).toBeNull()
    expect(derivePrice(makeOverview({ eps: -1 }))).toBeNull()
  })

  it('有真實報價時優先使用，並標記為 quote', () => {
    const overview = makeOverview({ peRatio: 20, eps: 3 })
    expect(resolvePrice(overview, 72)).toEqual({ value: 72, basis: 'quote' })
  })

  it('沒有真實報價時退回推導價', () => {
    const overview = makeOverview({ peRatio: 20, eps: 3 })
    expect(resolvePrice(overview, null)?.basis).toBe('derived')
    expect(resolvePrice(overview)?.basis).toBe('derived')
  })
})

describe('calcFairValue', () => {
  it('葛拉漢公式：√(22.5 × EPS × 每股淨值)', () => {
    // √(22.5 × 4 × 10) = √900 = 30
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), quote(25))
    expect(result.grahamNumber).toBeCloseTo(30, 6)
  })

  it('保守 P/E 法：EPS × 15', () => {
    const result = calcFairValue(makeOverview({ eps: 4 }), quote(25))
    expect(result.conservativeValue).toBe(60)
  })

  it('PEG 法的成長率上限為 25，避免高成長股估值失真', () => {
    const result = calcFairValue(makeOverview({ eps: 4, earningsGrowthYOY: 80 }), quote(25))
    // 若無上限會是 4 × 80 = 320
    expect(result.pegFairValue).toBe(100)
  })

  it('建議買入價含 25% 安全邊際', () => {
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), quote(25))
    expect(result.suggestedBuyPrice).toBeCloseTo(result.fairValueMid * 0.75, 6)
  })

  it('合理價區間包含中間值', () => {
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), quote(25))
    expect(result.fairValueLow).toBeLessThanOrEqual(result.fairValueMid)
    expect(result.fairValueHigh).toBeGreaterThanOrEqual(result.fairValueMid)
  })

  it('股價遠低於合理價 → 判定為低估', () => {
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), quote(20))
    expect(result.verdict).toBe('UNDERVALUED')
    expect(result.premiumDiscount!).toBeLessThan(0)
  })

  it('股價遠高於合理價 → 判定為昂貴', () => {
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), quote(200))
    expect(result.verdict).toBe('EXPENSIVE')
    expect(result.premiumDiscount!).toBeGreaterThan(0)
  })

  // EPS ≤ 0 表示公司虧損，三種估值法全部失效 —— 這時必須誠實說「算不出來」，
  // 而不是回傳一個看起來像數字的 0 讓使用者誤以為合理價是 0 元。
  it('虧損企業（EPS ≤ 0）標記為無法計算', () => {
    const result = calcFairValue(makeOverview({ eps: -1.5, bookValue: 10 }), quote(25))

    expect(result.canCalculate).toBe(false)
    expect(result.grahamNumber).toBeNull()
    expect(result.conservativeValue).toBeNull()
    expect(result.suggestedBuyPrice).toBe(0)
  })

  it('EPS 缺漏（而非為負）同樣無法估值', () => {
    const result = calcFairValue(makeOverview({ eps: null, bookValue: 10 }), quote(25))
    expect(result.canCalculate).toBe(false)
  })

  it('沒有比價基準時仍給出合理價區間，但不判斷貴賤', () => {
    // 合理價只需要 EPS 與帳面值，與市價無關；但「貴不貴」一定要有價格。
    // 這時回傳 FAIR 之類的結論等於憑空編造。
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), null)

    expect(result.canCalculate).toBe(true)
    expect(result.fairValueMid).toBeGreaterThan(0)
    expect(result.verdict).toBe('NO_PRICE')
    expect(result.premiumDiscount).toBeNull()
  })
})

describe('calcBuySignals', () => {
  it('回傳的價格帶有來源標記', () => {
    const result = calcBuySignals(makeOverview({ peRatio: 20, eps: 3 }))
    expect(result.price).toEqual({ value: 60, basis: 'derived' })
  })

  it('可以指定真實報價，覆蓋推導價', () => {
    const result = calcBuySignals(makeOverview({ peRatio: 20, eps: 3 }), quote(88))
    expect(result.price).toEqual({ value: 88, basis: 'quote' })
  })

  it('觸發數等於實際被標記為觸發的訊號數', () => {
    const result = calcBuySignals(makeOverview())
    expect(result.triggeredCount).toBe(result.signals.filter((s) => s.triggered).length)
  })

  it('低估標的觸發多數訊號', () => {
    const result = calcBuySignals(
      makeOverview({
        peRatio: 10, eps: 5,            // 推導價 50
        pegRatio: 0.8,                   // PEG < 1 → 觸發
        week52High: 100, week52Low: 45,  // 位置約 9% → 觸發
        movingAvg200: 70,                // 低於均線 → 觸發
        analystTargetPrice: 80,          // 上檔 60% → 觸發
        dividendYield: 4,                // ≥ 2% → 觸發
      })
    )

    expect(result.triggeredCount).toBe(5)
    expect(result.verdict).toBe('STRONG_BUY')
  })

  it('追高標的幾乎不觸發訊號', () => {
    const result = calcBuySignals(
      makeOverview({
        peRatio: 40, eps: 2.5,           // 推導價 100
        pegRatio: 4,                     // 過高
        week52High: 105, week52Low: 40,  // 接近高點
        movingAvg200: 70,                // 大幅高於均線
        analystTargetPrice: 90,          // 已超過目標價
        dividendYield: 0.5,              // 偏低
      })
    )

    expect(result.triggeredCount).toBe(0)
    expect(result.verdict).toBe('AVOID')
  })

  it('資料缺失的訊號會被略過，不會以「未觸發」混入判斷', () => {
    const result = calcBuySignals(
      makeOverview({ pegRatio: null, dividendYield: null, analystTargetPrice: null })
    )

    const ids = result.signals.map((s) => s.id)
    expect(ids).not.toContain('peg')
    expect(ids).not.toContain('dividend')
    expect(ids).not.toContain('analyst')
  })

  it('可評訊號少於三個時不下結論', () => {
    // 只剩 PEG 與股息兩個訊號 —— 兩個都觸發也不該宣告「強力進場」，
    // 那只是樣本太小造成的假象。
    const result = calcBuySignals(
      makeOverview({
        peRatio: null, eps: null, // 無價格 → 52 週、均線、分析師三訊號全消失
        pegRatio: 0.8,
        dividendYield: 5,
      })
    )

    expect(result.signals).toHaveLength(2)
    expect(result.triggeredCount).toBe(2)
    expect(result.verdict).toBe('INSUFFICIENT_DATA')
    expect(result.verdictText).toContain('不足以判斷')
  })

  it('分析師目標價的說明不得指名任何具體機構', () => {
    // AnalystTargetPrice 是不具名的綜合共識，替它掛上「高盛、摩根」
    // 之類的名字是不實陳述。
    const result = calcBuySignals(
      makeOverview({ peRatio: 10, eps: 5, analystTargetPrice: 80 })
    )
    const analyst = result.signals.find((s) => s.id === 'analyst')!

    for (const bank of ['高盛', '摩根', 'Goldman', 'Morgan']) {
      expect(analyst.detail).not.toContain(bank)
    }
  })

  it('說明文字要標明價格是推導出來的，不是即時市價', () => {
    const derived = calcBuySignals(makeOverview({ peRatio: 10, eps: 5, analystTargetPrice: 80 }))
    const real = calcBuySignals(makeOverview({ peRatio: 10, eps: 5, analystTargetPrice: 80 }), quote(50))

    expect(derived.signals.find((s) => s.id === 'analyst')!.detail).toContain('推導價')
    expect(real.signals.find((s) => s.id === 'analyst')!.detail).toContain('現價')
  })
})
