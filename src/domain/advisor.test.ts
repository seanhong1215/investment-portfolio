import { describe, it, expect } from 'vitest'
import {
  getRecommendation,
  type InvestorProfile,
  type RiskLevel,
  type TimeHorizon,
} from './advisor'

const RISK_LEVELS: RiskLevel[] = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE']
const HORIZONS: TimeHorizon[] = ['SHORT', 'MEDIUM', 'LONG', 'VERY_LONG']

function makeProfile(overrides: Partial<InvestorProfile> = {}): InvestorProfile {
  return {
    goal: 'RETIREMENT',
    timeHorizon: 'LONG',
    riskLevel: 'BALANCED',
    monthlyContribution: 1000,
    currentSavings: 10_000,
    ...overrides,
  }
}

// 風險 × 年限共 12 種組合，全部逐一驗證 —— 手動點過 UI 不可能穩定涵蓋這 12 格，
// 而任何一格的配置比例出錯，都會直接讓使用者的資金配置失衡。
describe('全部 12 種風險 × 年限組合', () => {
  const combos = RISK_LEVELS.flatMap((riskLevel) =>
    HORIZONS.map((timeHorizon) => ({ riskLevel, timeHorizon }))
  )

  it.each(combos)('$riskLevel × $timeHorizon 的配置總和為 100%', ({ riskLevel, timeHorizon }) => {
    const rec = getRecommendation(makeProfile({ riskLevel, timeHorizon }))
    const total = [...rec.etfCore, ...rec.stockSatellite].reduce((sum, i) => sum + i.percentage, 0)

    expect(total).toBe(100)
  })

  it.each(combos)('$riskLevel × $timeHorizon 每個標的都有名稱與理由', ({ riskLevel, timeHorizon }) => {
    const rec = getRecommendation(makeProfile({ riskLevel, timeHorizon }))

    for (const item of [...rec.etfCore, ...rec.stockSatellite]) {
      expect(item.name).not.toBe('')
      expect(item.reason).not.toBe('')
      // name 若 fallback 成 symbol，代表 ETF_INFO / STOCK_INFO 漏了這個標的
      expect(item.name).not.toBe(item.symbol)
    }
  })

  it.each(combos)('$riskLevel × $timeHorizon 有標題與買點策略', ({ riskLevel, timeHorizon }) => {
    const rec = getRecommendation(makeProfile({ riskLevel, timeHorizon }))

    expect(rec.title).not.toBe('個人化組合') // fallback 代表 TITLE_MAP 漏了這格
    expect(rec.buyStrategy.etfRule).not.toBe('')
    expect(rec.buyStrategy.triggers.length).toBeGreaterThan(0)
  })
})

describe('風險與配置的對應關係', () => {
  it('短期目標一律不配置個股（波動可能導致用錢時虧損）', () => {
    for (const riskLevel of RISK_LEVELS) {
      const rec = getRecommendation(makeProfile({ riskLevel, timeHorizon: 'SHORT' }))
      expect(rec.stockSatellite).toHaveLength(0)
    }
  })

  it('風險等級越高，預期報酬區間越高', () => {
    const conservative = getRecommendation(makeProfile({ riskLevel: 'CONSERVATIVE' }))
    const balanced = getRecommendation(makeProfile({ riskLevel: 'BALANCED' }))
    const aggressive = getRecommendation(makeProfile({ riskLevel: 'AGGRESSIVE' }))

    expect(conservative.expectedReturnMax).toBeLessThanOrEqual(balanced.expectedReturnMin)
    expect(balanced.expectedReturnMax).toBeLessThanOrEqual(aggressive.expectedReturnMin)
  })

  it('報酬區間的下限不高於上限', () => {
    for (const riskLevel of RISK_LEVELS) {
      const rec = getRecommendation(makeProfile({ riskLevel }))
      expect(rec.expectedReturnMin).toBeLessThan(rec.expectedReturnMax)
    }
  })

  it('短期目標的警語優先於風險等級警語', () => {
    const rec = getRecommendation(makeProfile({ riskLevel: 'AGGRESSIVE', timeHorizon: 'SHORT' }))
    expect(rec.warningNote).toContain('短期目標')
  })

  it('積極配置附上回檔幅度的警語', () => {
    const rec = getRecommendation(makeProfile({ riskLevel: 'AGGRESSIVE', timeHorizon: 'LONG' }))
    expect(rec.warningNote).toContain('30-40%')
  })
})

describe('未來價值試算', () => {
  it('年限越長累積金額越高', () => {
    const { projections } = getRecommendation(makeProfile())

    expect(projections.year5).toBeLessThan(projections.year10)
    expect(projections.year10).toBeLessThan(projections.year20)
  })

  it('月投入與本金皆為 0 時試算結果為 0', () => {
    const { projections } = getRecommendation(
      makeProfile({ monthlyContribution: 0, currentSavings: 0 })
    )

    expect(projections.year5).toBe(0)
    expect(projections.year20).toBe(0)
  })

  it('試算金額至少等於本金加總投入（正報酬下不可能更少）', () => {
    const profile = makeProfile({ monthlyContribution: 1000, currentSavings: 10_000 })
    const { projections } = getRecommendation(profile)
    const contributed = 10_000 + 1000 * 12 * 10

    expect(projections.year10).toBeGreaterThan(contributed)
  })

  // 對照獨立計算的複利終值，確認公式本身正確而不只是「有回傳數字」
  it('符合月複利年金終值公式', () => {
    const profile = makeProfile({
      riskLevel: 'BALANCED', // 預期報酬 7~9%，中位數 8%
      monthlyContribution: 500,
      currentSavings: 20_000,
    })

    const r = 0.08 / 12
    const n = 10 * 12
    const expected = Math.round(20_000 * (1 + r) ** n + 500 * (((1 + r) ** n - 1) / r))

    expect(getRecommendation(profile).projections.year10).toBe(expected)
  })
})
