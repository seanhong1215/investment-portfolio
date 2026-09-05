import { describe, it, expect } from 'vitest'
import {
  getRecommendation,
  projectFV,
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

describe('projectFV', () => {
  it('沒有本金與投入時未來價值為 0', () => {
    expect(projectFV(0, 0, 7, 10)).toBe(0)
  })

  it('只有本金時等於單純複利（月複利 10 年）', () => {
    // 1000 × (1 + 0.12/12)^120 = 1000 × 1.01^120
    expect(projectFV(1000, 0, 12, 10)).toBeCloseTo(1000 * Math.pow(1.01, 120), 6)
  })

  it('只有月投入時等於年金終值', () => {
    // 100 × ((1.01)^120 − 1) / 0.01
    expect(projectFV(0, 100, 12, 10)).toBeCloseTo(100 * (Math.pow(1.01, 120) - 1) / 0.01, 6)
  })

  // 這是這個函式唯一的除以零邊界：r = 0 時 (…)/r 會得到 NaN，
  // 而 NaN 一路渲染到畫面上就是「NaN 元」。
  it('報酬率為 0 時退化成單純累加，而不是 NaN', () => {
    const result = projectFV(1000, 100, 0, 10)

    expect(Number.isNaN(result)).toBe(false)
    expect(result).toBe(1000 + 100 * 120)
  })

  it('報酬率為 0 且無本金時等於總投入額', () => {
    expect(projectFV(0, 500, 0, 3)).toBe(500 * 36)
  })
})
