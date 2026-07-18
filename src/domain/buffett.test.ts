import { describe, it, expect } from 'vitest'
import { analyzeBuffett, calcFairValue, calcBuySignals } from './buffett'
import { makeOverview } from './testFactories'

describe('analyzeBuffett', () => {
  it('評分落在 0 ~ 100', () => {
    const strong = analyzeBuffett(makeOverview({ roe: 45, debtToEquity: 0.2, profitMargin: 35 }))
    const weak = analyzeBuffett(
      makeOverview({ roe: -10, debtToEquity: 5, profitMargin: -5, peRatio: 0, earningsGrowthYOY: -30, currentRatio: 0.3 })
    )

    expect(strong.totalScore).toBeLessThanOrEqual(100)
    expect(weak.totalScore).toBeGreaterThanOrEqual(0)
    expect(strong.totalScore).toBeGreaterThan(weak.totalScore)
  })

  it('優質企業拿到高評級與買進建議', () => {
    const result = analyzeBuffett(
      makeOverview({ roe: 35, debtToEquity: 0.3, profitMargin: 30, peRatio: 18, earningsGrowthYOY: 20, currentRatio: 2.0 })
    )

    expect(result.totalScore).toBeGreaterThanOrEqual(75)
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

  it('每項得分不超過該項權重', () => {
    const { criteria } = analyzeBuffett(makeOverview({ roe: 99, profitMargin: 99, currentRatio: 99 }))
    for (const c of criteria) {
      expect(c.score).toBeLessThanOrEqual(c.weight)
      expect(c.score).toBeGreaterThanOrEqual(0)
    }
  })

  it('P/E 為 0 或負值（虧損企業）時該項不給分且顯示 N/A', () => {
    const { criteria } = analyzeBuffett(makeOverview({ peRatio: 0 }))
    const pe = criteria.find((c) => c.name.includes('本益比'))!

    expect(pe.displayValue).toBe('N/A')
    expect(pe.score).toBe(0)
    expect(pe.pass).toBe(false)
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
})

describe('calcFairValue', () => {
  it('葛拉漢公式：√(22.5 × EPS × 每股淨值)', () => {
    // √(22.5 × 4 × 10) = √900 = 30
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), 25)
    expect(result.grahamNumber).toBeCloseTo(30, 6)
  })

  it('保守 P/E 法：EPS × 15', () => {
    const result = calcFairValue(makeOverview({ eps: 4 }), 25)
    expect(result.conservativeValue).toBe(60)
  })

  it('PEG 法的成長率上限為 25，避免高成長股估值失真', () => {
    const result = calcFairValue(makeOverview({ eps: 4, earningsGrowthYOY: 80 }), 25)
    // 若無上限會是 4 × 80 = 320
    expect(result.pegFairValue).toBe(100)
  })

  it('建議買入價含 25% 安全邊際', () => {
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), 25)
    expect(result.suggestedBuyPrice).toBeCloseTo(result.fairValueMid * 0.75, 6)
  })

  it('合理價區間包含中間值', () => {
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), 25)
    expect(result.fairValueLow).toBeLessThanOrEqual(result.fairValueMid)
    expect(result.fairValueHigh).toBeGreaterThanOrEqual(result.fairValueMid)
  })

  it('股價遠低於合理價 → 判定為低估', () => {
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), 20)
    expect(result.verdict).toBe('UNDERVALUED')
    expect(result.premiumDiscount).toBeLessThan(0)
  })

  it('股價遠高於合理價 → 判定為昂貴', () => {
    const result = calcFairValue(makeOverview({ eps: 4, bookValue: 10 }), 200)
    expect(result.verdict).toBe('EXPENSIVE')
    expect(result.premiumDiscount).toBeGreaterThan(0)
  })

  // EPS ≤ 0 表示公司虧損，三種估值法全部失效 —— 這時必須誠實說「算不出來」，
  // 而不是回傳一個看起來像數字的 0 讓使用者誤以為合理價是 0 元。
  it('虧損企業（EPS ≤ 0）標記為無法計算', () => {
    const result = calcFairValue(makeOverview({ eps: -1.5, bookValue: 10 }), 25)

    expect(result.canCalculate).toBe(false)
    expect(result.grahamNumber).toBeNull()
    expect(result.conservativeValue).toBeNull()
    expect(result.suggestedBuyPrice).toBe(0)
  })
})

describe('calcBuySignals', () => {
  it('用 P/E × EPS 推算隱含現價，避免額外一次 API 呼叫', () => {
    const result = calcBuySignals(makeOverview({ peRatio: 20, eps: 3 }))
    expect(result.impliedPrice).toBe(60)
  })

  it('P/E 或 EPS 缺失時隱含現價為 0', () => {
    expect(calcBuySignals(makeOverview({ peRatio: 0, eps: 3 })).impliedPrice).toBe(0)
    expect(calcBuySignals(makeOverview({ eps: 0 })).impliedPrice).toBe(0)
  })

  it('觸發數等於實際被標記為觸發的訊號數', () => {
    const result = calcBuySignals(makeOverview())
    expect(result.triggeredCount).toBe(result.signals.filter((s) => s.triggered).length)
  })

  it('低估標的觸發多數訊號 → 強力買進', () => {
    const result = calcBuySignals(
      makeOverview({
        peRatio: 10, eps: 5,            // 隱含現價 50
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

  it('追高標的幾乎不觸發訊號 → 不建議進場', () => {
    const result = calcBuySignals(
      makeOverview({
        peRatio: 40, eps: 2.5,           // 隱含現價 100
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

  it('資料缺失的訊號會被略過，不會以 0 混入判斷', () => {
    const result = calcBuySignals(
      makeOverview({ pegRatio: 0, dividendYield: 0, analystTargetPrice: 0 })
    )

    const ids = result.signals.map((s) => s.id)
    expect(ids).not.toContain('peg')
    expect(ids).not.toContain('dividend')
    expect(ids).not.toContain('analyst')
  })
})
