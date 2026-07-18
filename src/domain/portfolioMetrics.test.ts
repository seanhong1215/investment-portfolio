import { describe, it, expect } from 'vitest'
import {
  gainPercent,
  calcPortfolioTotals,
  summarizePortfolios,
  calcAllocation,
  calcTypeMix,
  calcDrift,
  calcGoalProgress,
} from './portfolioMetrics'
import { makeItem, makeStock, makePortfolio } from './testFactories'

describe('gainPercent', () => {
  it('計算正報酬', () => {
    expect(gainPercent(1000, 250)).toBe(25)
  })

  it('計算負報酬', () => {
    expect(gainPercent(1000, -400)).toBe(-40)
  })

  // 這是抽出這個函式的主因：剛建立、尚未下單的組合投入金額就是 0，
  // 直接相除會讓畫面顯示「NaN%」。
  it('投入為 0 時回傳 0，不是 NaN 或 Infinity', () => {
    expect(gainPercent(0, 0)).toBe(0)
    expect(gainPercent(0, 500)).toBe(0)
  })

  it('投入為負數（不應發生的髒資料）時也不回傳 Infinity', () => {
    expect(Number.isFinite(gainPercent(-100, 50))).toBe(true)
  })
})

describe('calcPortfolioTotals', () => {
  it('由持倉推導總額與報酬率', () => {
    const items = [
      makeItem({ investedAmount: 1000, currentValue: 1200 }),
      makeItem({ investedAmount: 1000, currentValue: 900 }),
    ]

    expect(calcPortfolioTotals(items)).toEqual({
      totalInvested: 2000,
      totalValue: 2100,
      totalGain: 100,
      totalGainPercent: 5,
    })
  })

  it('空組合回傳全 0', () => {
    expect(calcPortfolioTotals([])).toEqual({
      totalInvested: 0,
      totalValue: 0,
      totalGain: 0,
      totalGainPercent: 0,
    })
  })
})

describe('summarizePortfolios', () => {
  it('跨組合彙總', () => {
    const portfolios = [
      makePortfolio({ totalInvested: 5000, totalValue: 6000 }),
      makePortfolio({ totalInvested: 5000, totalValue: 4500 }),
    ]

    const summary = summarizePortfolios(portfolios)
    expect(summary.totalInvested).toBe(10_000)
    expect(summary.totalValue).toBe(10_500)
    expect(summary.totalGain).toBe(500)
    expect(summary.totalGainPercent).toBe(5)
  })

  it('沒有任何組合時回傳全 0', () => {
    expect(summarizePortfolios([]).totalGainPercent).toBe(0)
  })
})

describe('calcAllocation', () => {
  it('依市值計算佔比並由大到小排序', () => {
    const items = [
      makeItem({ stock: makeStock({ symbol: 'AAPL' }), currentValue: 2500 }),
      makeItem({ stock: makeStock({ symbol: 'VOO' }), currentValue: 7500 }),
    ]

    const allocation = calcAllocation(items)
    // 排序必須穩定：類別色票依順序指派，順序跳動會讓標的重整後換色
    expect(allocation.map((s) => s.symbol)).toEqual(['VOO', 'AAPL'])
    expect(allocation[0].percent).toBe(75)
    expect(allocation[1].percent).toBe(25)
  })

  it('佔比總和為 100', () => {
    const items = [
      makeItem({ stock: makeStock({ symbol: 'A' }), currentValue: 333 }),
      makeItem({ stock: makeStock({ symbol: 'B' }), currentValue: 333 }),
      makeItem({ stock: makeStock({ symbol: 'C' }), currentValue: 334 }),
    ]

    const total = calcAllocation(items).reduce((sum, s) => sum + s.percent, 0)
    expect(total).toBeCloseTo(100, 10)
  })

  it('市值全為 0 時佔比為 0 而非 NaN', () => {
    const items = [makeItem({ currentValue: 0 })]
    expect(calcAllocation(items)[0].percent).toBe(0)
  })
})

describe('calcTypeMix', () => {
  it('算出核心衛星策略的 ETF / 個股比重', () => {
    const items = [
      makeItem({ stock: makeStock({ symbol: 'VOO', type: 'ETF' }), currentValue: 7000 }),
      makeItem({ stock: makeStock({ symbol: 'AAPL', type: 'STOCK' }), currentValue: 3000 }),
    ]

    expect(calcTypeMix(items)).toEqual({ etfPercent: 70, stockPercent: 30 })
  })

  it('全部是 ETF 時個股為 0', () => {
    const items = [makeItem({ stock: makeStock({ type: 'ETF' }), currentValue: 100 })]
    expect(calcTypeMix(items)).toEqual({ etfPercent: 100, stockPercent: 0 })
  })

  it('空組合不回傳 NaN', () => {
    expect(calcTypeMix([])).toEqual({ etfPercent: 0, stockPercent: 0 })
  })
})

describe('calcDrift', () => {
  const items = [
    makeItem({ stock: makeStock({ symbol: 'VOO' }), currentValue: 8000 }),
    makeItem({ stock: makeStock({ symbol: 'AAPL' }), currentValue: 2000 }),
  ]

  it('標記偏離超過門檻的標的', () => {
    const drift = calcDrift(items, [
      { symbol: 'VOO', percentage: 70 },
      { symbol: 'AAPL', percentage: 30 },
    ])

    // VOO 實際 80% vs 目標 70% → 超配 10 個百分點
    expect(drift[0]).toMatchObject({ actualPercent: 80, driftPercent: 10, needsRebalance: true })
    // AAPL 實際 20% vs 目標 30% → 低配 10 個百分點
    expect(drift[1]).toMatchObject({ actualPercent: 20, driftPercent: -10, needsRebalance: true })
  })

  it('偏離小於門檻時不需要再平衡', () => {
    const drift = calcDrift(items, [{ symbol: 'VOO', percentage: 78 }])
    expect(drift[0].driftPercent).toBe(2)
    expect(drift[0].needsRebalance).toBe(false)
  })

  it('恰好等於門檻時需要再平衡（門檻為閉區間）', () => {
    const drift = calcDrift(items, [{ symbol: 'VOO', percentage: 75 }], 5)
    expect(drift[0].needsRebalance).toBe(true)
  })

  it('目標有但實際未持有的標的，實際佔比視為 0', () => {
    const drift = calcDrift(items, [{ symbol: 'BND', percentage: 20 }])
    expect(drift[0]).toMatchObject({ actualPercent: 0, driftPercent: -20, needsRebalance: true })
  })
})

describe('calcGoalProgress', () => {
  it('計算達成百分比', () => {
    expect(calcGoalProgress(2500, 10_000)).toBe(25)
  })

  it('超額達成時上限為 100（進度條無法表達超過滿格）', () => {
    expect(calcGoalProgress(13_700, 10_000)).toBe(100)
  })

  it('未設定目標金額時回傳 0 而非 Infinity', () => {
    expect(calcGoalProgress(5000, 0)).toBe(0)
  })
})
