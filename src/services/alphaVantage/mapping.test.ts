/**
 * Adapter 層的測試。
 *
 * 重構前 services 層是零測試的 —— 欄位對應與 fetch 綁在同一個 class 裡，
 * 要測就得攔截網路。把純對應邏輯拆出來後，用固定的樣本 payload 就能測，
 * 而這一層恰好是最容易出錯、出錯後又最難察覺的地方：型別檢查擋不住
 * 「欄位名稱拼錯」或「單位少乘 100」，它們只會讓數字悄悄地不對。
 */

import { describe, it, expect } from 'vitest'
import {
  parseFundamental,
  detectApiError,
  toCompanyOverview,
  toStock,
  AlphaVantageError,
} from './mapping'

/** 取自 Alpha Vantage OVERVIEW 的真實回應形狀（數值已簡化） */
const OVERVIEW_PAYLOAD: Record<string, unknown> = {
  Symbol: 'KO',
  AssetType: 'Common Stock',
  Name: 'Coca-Cola Company',
  Sector: 'CONSUMER STAPLES',
  Industry: 'BEVERAGES',
  MarketCapitalization: '260000000000',
  PERatio: '24.5',
  PEGRatio: '2.5',
  BookValue: '5.5',
  PriceToBookRatio: '11.2',
  EPS: '2.47',
  ReturnOnEquityTTM: '0.402',
  ProfitMargin: '0.234',
  OperatingMarginTTM: '0.301',
  QuarterlyRevenueGrowthYOY: '0.061',
  QuarterlyEarningsGrowthYOY: '0.122',
  DividendYield: '0.031',
  '52WeekHigh': '65.5',
  '52WeekLow': '51.2',
  '50DayMovingAverage': '60.1',
  '200DayMovingAverage': '58.4',
  AnalystTargetPrice: '68.0',
}

describe('parseFundamental', () => {
  it('解析正常的數字字串', () => {
    expect(parseFundamental('24.5')).toBe(24.5)
    expect(parseFundamental('-3')).toBe(-3)
    expect(parseFundamental('0')).toBe(0)
  })

  // 這幾條是整次重構的核心：缺漏值必須是 null，永遠不能是 0。
  it.each(['None', 'none', '-', '', '   ', 'null'])('把 %j 視為缺漏而非 0', (raw) => {
    expect(parseFundamental(raw)).toBeNull()
  })

  it('欄位不存在時回傳 null', () => {
    expect(parseFundamental(undefined)).toBeNull()
    expect(parseFundamental(null)).toBeNull()
  })

  it('無法解析的字串回傳 null，不回傳 NaN', () => {
    // NaN 一旦流進計算就會污染整條運算鏈，而且不會拋錯。
    expect(parseFundamental('abc')).toBeNull()
    expect(parseFundamental(Number.NaN)).toBeNull()
    expect(parseFundamental(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('0 是有效值，不可與缺漏混為一談', () => {
    expect(parseFundamental('0')).not.toBeNull()
    expect(parseFundamental('0.00')).toBe(0)
  })
})

describe('detectApiError', () => {
  // Alpha Vantage 對所有錯誤都回 HTTP 200，把原因塞在 body 裡，
  // 因此 response.ok 完全不能當成成功的判準。
  it('Error Message → 代碼不存在', () => {
    const err = detectApiError({ 'Error Message': 'Invalid API call' })
    expect(err?.kind).toBe('unknown-symbol')
  })

  it('Note → 每分鐘頻率上限', () => {
    expect(detectApiError({ Note: 'Thank you for using...' })?.kind).toBe('rate-limit-minute')
  })

  it('Information 提到每日上限 → 每日配額用盡', () => {
    const err = detectApiError({ Information: 'You have reached the 25 requests/day limit' })
    expect(err?.kind).toBe('rate-limit-daily')
  })

  it('Information 提到 premium → 需付費金鑰', () => {
    const err = detectApiError({ Information: 'This is a premium endpoint' })
    expect(err?.kind).toBe('premium-required')
  })

  it('其他 Information → 金鑰無效', () => {
    expect(detectApiError({ Information: 'invalid apikey' })?.kind).toBe('invalid-key')
  })

  it('正常回應沒有錯誤', () => {
    expect(detectApiError(OVERVIEW_PAYLOAD)).toBeNull()
  })

  it('配額類錯誤可以靠手動輸入繞過，代碼不存在則不行', () => {
    // UI 依這個旗標決定要不要顯示「改用手動輸入」，比比對訊息字串可靠。
    expect(detectApiError({ Note: 'x' })!.recoverableByManualInput).toBe(true)
    expect(detectApiError({ 'Error Message': 'x' })!.recoverableByManualInput).toBe(false)
  })
})

describe('toCompanyOverview', () => {
  it('對應基本欄位並標記來源', () => {
    const overview = toCompanyOverview(OVERVIEW_PAYLOAD, 1_700_000_000_000)

    expect(overview.symbol).toBe('KO')
    expect(overview.name).toBe('Coca-Cola Company')
    expect(overview.source).toBe('alpha-vantage')
    expect(overview.retrievedAt).toBe(1_700_000_000_000)
    expect(overview.peRatio).toBe(24.5)
    expect(overview.eps).toBe(2.47)
  })

  it('把小數比率換算成百分比，讓 domain 只面對一種單位', () => {
    const overview = toCompanyOverview(OVERVIEW_PAYLOAD, 0)

    expect(overview.roe).toBeCloseTo(40.2, 10)
    expect(overview.profitMargin).toBeCloseTo(23.4, 10)
    expect(overview.dividendYield).toBeCloseTo(3.1, 10)
    expect(overview.earningsGrowthYOY).toBeCloseTo(12.2, 10)
  })

  /**
   * 這是引發整次重構的那個缺陷。
   *
   * 免費 OVERVIEW 端點從來沒有這兩個鍵，舊 parser 的 `parseFloat(v||'0')||0`
   * 把它們都變成 0，讓巴菲特評分的 15 分永遠滿分、10 分永遠零分。
   */
  it('OVERVIEW 未提供的欄位是 null，不是 0', () => {
    const overview = toCompanyOverview(OVERVIEW_PAYLOAD, 0)

    expect(OVERVIEW_PAYLOAD).not.toHaveProperty('DebtToEquityRatio')
    expect(OVERVIEW_PAYLOAD).not.toHaveProperty('CurrentRatio')
    expect(overview.debtToEquity).toBeNull()
    expect(overview.currentRatio).toBeNull()
  })

  it('付費金鑰若補上這些欄位會自動生效', () => {
    const overview = toCompanyOverview(
      { ...OVERVIEW_PAYLOAD, DebtToEquityRatio: '1.62', CurrentRatio: '1.13' },
      0,
    )
    expect(overview.debtToEquity).toBe(1.62)
    expect(overview.currentRatio).toBe(1.13)
  })

  it('個別欄位是 "None" 時只有該欄位變 null，其餘不受影響', () => {
    const overview = toCompanyOverview({ ...OVERVIEW_PAYLOAD, PEGRatio: 'None' }, 0)

    expect(overview.pegRatio).toBeNull()
    expect(overview.peRatio).toBe(24.5)
  })

  it('ETF 被拒絕，且標記為無法靠手動輸入補救', () => {
    // 手動輸入也一樣分析不了 ETF，所以不該引導使用者去填表。
    let error: unknown
    try {
      toCompanyOverview({ ...OVERVIEW_PAYLOAD, Symbol: 'VOO', AssetType: 'ETF' }, 0)
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(AlphaVantageError)
    expect((error as AlphaVantageError).kind).toBe('unsupported-asset')
    expect((error as AlphaVantageError).recoverableByManualInput).toBe(false)
  })

  it('空回應（查無此代碼）拋出 empty-response', () => {
    expect(() => toCompanyOverview({}, 0)).toThrow(AlphaVantageError)
  })

  it('API 錯誤優先於欄位解析被拋出', () => {
    expect(() => toCompanyOverview({ Note: 'rate limited' }, 0)).toThrowError(/每分鐘/)
  })
})

describe('toStock', () => {
  const QUOTE_PAYLOAD = {
    'Global Quote': {
      '01. symbol': 'AAPL',
      '05. price': '227.5200',
      '09. change': '-1.2300',
      '10. change percent': '-0.5376%',
    },
  }

  it('對應報價欄位', () => {
    const stock = toStock(QUOTE_PAYLOAD, 'aapl', 12345)

    expect(stock.symbol).toBe('AAPL')
    expect(stock.price).toBe(227.52)
    expect(stock.change).toBe(-1.23)
    expect(stock.lastUpdate).toBe(12345)
  })

  it('去掉漲跌幅欄位的百分號', () => {
    expect(toStock(QUOTE_PAYLOAD, 'AAPL', 0).changePercent).toBeCloseTo(-0.5376, 10)
  })

  it('Global Quote 為空物件時拋錯，而不是回傳一檔價格為 0 的股票', () => {
    expect(() => toStock({ 'Global Quote': {} }, 'AAPL', 0)).toThrow(AlphaVantageError)
  })

  it('缺少價格欄位時拋錯', () => {
    expect(() => toStock({ 'Global Quote': { '01. symbol': 'AAPL' } }, 'AAPL', 0)).toThrow(
      AlphaVantageError,
    )
  })
})
