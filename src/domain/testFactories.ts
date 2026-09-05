/**
 * 測試資料工廠。
 *
 * 為什麼要有這個檔案：Portfolio 有 14 個欄位，但每條測試通常只在意其中
 * 一兩個。若每條測試都手寫完整物件，真正被驗證的欄位會淹沒在雜訊裡，
 * 型別一改也要改上百處。工廠給定合理預設，測試只覆寫它關心的部分。
 */

import type { Portfolio, PortfolioItem, Stock, CompanyOverview } from '@/types'

export function makeStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: 'VOO',
    name: 'Vanguard S&P 500',
    price: 100,
    change: 0,
    changePercent: 0,
    lastUpdate: 0,
    type: 'ETF',
    ...overrides,
  }
}

export function makeItem(overrides: Partial<PortfolioItem> = {}): PortfolioItem {
  const stock = overrides.stock ?? makeStock()
  return {
    id: `item-${stock.symbol}`,
    stock,
    allocationPercentage: 100,
    investedAmount: 1000,
    currentValue: 1000,
    unrealizedGain: 0,
    unrealizedGainPercent: 0,
    purchaseDate: 0,
    ...overrides,
  }
}

export function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
    name: '測試組合',
    items: [],
    targetAmount: 0,
    totalInvested: 0,
    totalValue: 0,
    totalGain: 0,
    totalGainPercent: 0,
    investmentGoal: 'SAVINGS',
    createdDate: 0,
    lastModified: 0,
    isDefault: false,
    ...overrides,
  }
}

/**
 * 預設值刻意設成一家「巴菲特會喜歡」的公司，測試再往下調成不及格。
 *
 * 這裡每一項基本面都給了數值，代表「資料完整」的情境。要測缺漏資料的
 * 行為就明確覆寫成 `null`（例如 `makeOverview({ currentRatio: null })`），
 * 讓「缺漏」在測試裡是刻意寫出來的意圖，而不是忘了填欄位。
 */
export function makeOverview(overrides: Partial<CompanyOverview> = {}): CompanyOverview {
  return {
    symbol: 'KO',
    name: 'Coca-Cola',
    sector: 'Consumer Defensive',
    industry: 'Beverages',
    source: 'manual',
    retrievedAt: 0,
    marketCap: 260_000_000_000,
    peRatio: 24,
    pegRatio: 2.5,
    roe: 40,
    debtToEquity: 1.6,
    profitMargin: 23,
    operatingMargin: 30,
    revenueGrowthYOY: 6,
    earningsGrowthYOY: 12,
    dividendYield: 3.1,
    bookValue: 5.5,
    priceToBook: 11,
    eps: 2.5,
    currentRatio: 1.1,
    week52High: 65,
    week52Low: 51,
    movingAvg50: 60,
    movingAvg200: 58,
    analystTargetPrice: 68,
    ...overrides,
  }
}
