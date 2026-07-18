import { describe, it, expect } from 'vitest'
import {
  recommendedConfigurations,
  getAllRecommendedConfigurations,
  getRecommendedConfiguration,
} from './presets'

describe('預設配置資料完整性', () => {
  // 這條測試是本次重構抓到的真實 bug：
  // 原「積極派」的比例總和是 104%，使用者選了之後會被要求投入超過本金的錢，
  // 而且沒有任何機制擋得下來 —— 因為當時整個專案沒有測試。
  it.each(recommendedConfigurations)('「$name」的配置比例總和為 100%', (config) => {
    const total = config.items.reduce((sum, item) => sum + item.percentage, 0)
    expect(total).toBe(100)
  })

  it.each(recommendedConfigurations)('「$name」沒有重複的標的', (config) => {
    const symbols = config.items.map((item) => item.symbol)
    expect(new Set(symbols).size).toBe(symbols.length)
  })

  it.each(recommendedConfigurations)('「$name」每個標的比例都為正數', (config) => {
    for (const item of config.items) {
      expect(item.percentage).toBeGreaterThan(0)
    }
  })

  it('配置 id 不重複', () => {
    const ids = recommendedConfigurations.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每種風險等級都至少有一個配置可選', () => {
    const levels = new Set(recommendedConfigurations.map((c) => c.riskLevel))
    expect(levels).toEqual(new Set(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE']))
  })
})

describe('平衡配置符合核心衛星策略', () => {
  it('ETF 佔 70%、個股佔 30%', () => {
    const balanced = getRecommendedConfiguration('balanced')!
    const etf = balanced.items
      .filter((i) => i.type === 'ETF')
      .reduce((sum, i) => sum + i.percentage, 0)

    expect(etf).toBe(70)
    expect(100 - etf).toBe(30)
  })
})

describe('查詢函式', () => {
  it('getAllRecommendedConfigurations 回傳全部配置', () => {
    expect(getAllRecommendedConfigurations()).toHaveLength(recommendedConfigurations.length)
  })

  it('getRecommendedConfiguration 依 id 取得配置', () => {
    expect(getRecommendedConfiguration('balanced')?.name).toBe('平衡配置')
  })

  it('id 不存在時回傳 undefined', () => {
    expect(getRecommendedConfiguration('does-not-exist')).toBeUndefined()
  })
})
