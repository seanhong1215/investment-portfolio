/**
 * Alpha Vantage 回應 → 應用型別的對應層。
 *
 * 這個檔案**刻意不含任何 I/O**：輸入是已經 parse 好的 JSON 物件，輸出是
 * 應用型別或錯誤。原因是這裡才是真正容易出錯、也真正值得測試的地方 ——
 * 欄位名稱、單位換算、缺漏值的語意。把 fetch 留在 client.ts，這一層就能
 * 用固定的樣本 payload 直接測，不需要攔截網路。
 *
 * 重構前這些邏輯與 fetch 混在同一個 class 裡，於是整個 services 層零測試，
 * 而 `parseFloat(v || '0') || 0` 造成的資料污染也就一直沒被發現。
 */

import type { CompanyOverview, Fundamental, Stock } from '@/types'

/**
 * 免費 OVERVIEW 端點**不會回傳**的欄位。
 *
 * 這份清單是重構的起點：`DebtToEquityRatio` 與 `CurrentRatio` 從來就不在
 * 回應裡，但舊的 parser 把缺漏值換成 0，讓巴菲特評分中 25 分的權重變成
 * 與公司無關的常數（負債項恆滿分、流動比率項恆零分）。
 *
 * 現在缺漏值一律是 `null`，domain 層會把它們排除在計分之外。使用者若要
 * 納入這兩項，可從手動輸入模式補上。
 */
export const OVERVIEW_UNAVAILABLE_FIELDS = ['debtToEquity', 'currentRatio'] as const

/** Alpha Vantage 用這些字串表示「沒有這個數字」，它們都不是 0 */
const MISSING_TOKENS = new Set(['none', '-', '', 'nan', 'null', 'undefined'])

/**
 * 把 API 的字串欄位轉成數值。
 *
 * 缺漏一律回傳 `null` 而非 0。`parseFloat('None') || 0` 這種寫法會讓
 * 「沒有資料」與「數值為零」在型別邊界上永久合併，下游再也救不回來 ——
 * 對負債比而言，0 是滿分、null 是不計分，兩者天差地遠。
 */
export function parseFundamental(raw: unknown): Fundamental {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (MISSING_TOKENS.has(trimmed.toLowerCase())) return null

  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/** 比率轉百分比。null 必須保持 null，不能變成 0 */
function toPercent(raw: unknown): Fundamental {
  const value = parseFundamental(raw)
  return value === null ? null : value * 100
}

// ── 錯誤 ──

export type AlphaVantageErrorKind =
  | 'unknown-symbol'
  | 'rate-limit-minute'
  | 'rate-limit-daily'
  | 'premium-required'
  | 'invalid-key'
  | 'unsupported-asset'
  | 'empty-response'

/**
 * 帶分類的 API 錯誤。
 *
 * 用 `kind` 而不是比對訊息字串，是因為 UI 需要依錯誤種類決定後續動作：
 * 配額用盡時應該引導使用者切到手動輸入模式，但「這是 ETF」不該引導 ——
 * 手動輸入也一樣分析不了 ETF。靠 `error.message.includes('ETF')` 來分支
 * 會在文案一改就默默失效。
 */
export class AlphaVantageError extends Error {
  constructor(
    readonly kind: AlphaVantageErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'AlphaVantageError'
  }

  /** 這個錯誤能否靠改用手動輸入繞過 */
  get recoverableByManualInput(): boolean {
    return this.kind !== 'unsupported-asset' && this.kind !== 'unknown-symbol'
  }
}

type Payload = Record<string, unknown>

/**
 * 偵測 API 層級的錯誤。
 *
 * Alpha Vantage 對錯誤一律回 HTTP 200，把原因塞在 body 的
 * `Error Message` / `Note` / `Information` 三個鍵裡，因此
 * `response.ok` 完全不能作為成功的判準。
 */
export function detectApiError(payload: Payload): AlphaVantageError | null {
  if (typeof payload['Error Message'] === 'string') {
    return new AlphaVantageError('unknown-symbol', '找不到這個股票代碼，請確認是否為美股代碼。')
  }

  if (typeof payload['Note'] === 'string') {
    return new AlphaVantageError(
      'rate-limit-minute',
      'API 請求頻率超過限制（免費版每分鐘 5 次）\n請等待約 1 分鐘後再試。',
    )
  }

  const info = payload['Information']
  if (typeof info === 'string') {
    const lower = info.toLowerCase()

    if (lower.includes('rate limit') || lower.includes('25 requests') || lower.includes('daily')) {
      return new AlphaVantageError(
        'rate-limit-daily',
        'API 每日請求次數已達上限（免費版每日 25 次）\n請明天再試，或改用手動輸入模式。',
      )
    }
    if (lower.includes('premium')) {
      return new AlphaVantageError(
        'premium-required',
        '此端點需要付費 API 金鑰\n免費金鑰無法使用，請改用手動輸入模式。',
      )
    }
    return new AlphaVantageError(
      'invalid-key',
      'API 金鑰無效或未設定\n請在 .env 檔案中設定 VITE_ALPHA_VANTAGE_API_KEY。',
    )
  }

  return null
}

// ── OVERVIEW ──

const ETF_ASSET_TYPES = new Set(['exchange traded fund', 'etf'])

/**
 * OVERVIEW 回應 → CompanyOverview。
 *
 * @throws AlphaVantageError 回應為錯誤、為空、或標的是 ETF 時
 */
export function toCompanyOverview(payload: Payload, retrievedAt: number): CompanyOverview {
  const apiError = detectApiError(payload)
  if (apiError) throw apiError

  const symbol = payload['Symbol']
  if (typeof symbol !== 'string' || symbol === '') {
    throw new AlphaVantageError(
      'empty-response',
      '查無此公司的基本面資料，請確認是否為美股個股代碼。',
    )
  }

  const assetType = String(payload['AssetType'] ?? '').toLowerCase()
  if (ETF_ASSET_TYPES.has(assetType)) {
    throw new AlphaVantageError(
      'unsupported-asset',
      `${symbol} 是 ETF，巴菲特分析僅適用個股（如 AAPL、KO、MSFT）。\n` +
        'ETF 本身已是一籃子持股，適合定期定額，無須個股選股分析。',
    )
  }

  return {
    symbol,
    name: typeof payload['Name'] === 'string' ? payload['Name'] : symbol,
    sector: typeof payload['Sector'] === 'string' ? payload['Sector'] : '未知',
    industry: typeof payload['Industry'] === 'string' ? payload['Industry'] : '未知',
    source: 'alpha-vantage',
    retrievedAt,

    marketCap: parseFundamental(payload['MarketCapitalization']),
    peRatio: parseFundamental(payload['PERatio']),
    pegRatio: parseFundamental(payload['PEGRatio']),
    bookValue: parseFundamental(payload['BookValue']),
    priceToBook: parseFundamental(payload['PriceToBookRatio']),
    eps: parseFundamental(payload['EPS']),

    // 這幾項 API 以小數回傳（0.234 = 23.4%），統一在邊界換算成百分比，
    // 讓 domain 層只需面對一種單位。
    roe: toPercent(payload['ReturnOnEquityTTM']),
    profitMargin: toPercent(payload['ProfitMargin']),
    operatingMargin: toPercent(payload['OperatingMarginTTM']),
    revenueGrowthYOY: toPercent(payload['QuarterlyRevenueGrowthYOY']),
    earningsGrowthYOY: toPercent(payload['QuarterlyEarningsGrowthYOY']),
    dividendYield: toPercent(payload['DividendYield']),

    // 免費 OVERVIEW 不提供這兩項（見 OVERVIEW_UNAVAILABLE_FIELDS）。
    // 仍然讀取是為了付費金鑰或日後端點補上時能自動生效，
    // 缺漏時得到 null，由 domain 層排除計分。
    debtToEquity: parseFundamental(payload['DebtToEquityRatio']),
    currentRatio: parseFundamental(payload['CurrentRatio']),

    week52High: parseFundamental(payload['52WeekHigh']),
    week52Low: parseFundamental(payload['52WeekLow']),
    movingAvg50: parseFundamental(payload['50DayMovingAverage']),
    movingAvg200: parseFundamental(payload['200DayMovingAverage']),
    analystTargetPrice: parseFundamental(payload['AnalystTargetPrice']),
  }
}

// ── GLOBAL_QUOTE ──

/**
 * GLOBAL_QUOTE 回應 → Stock。
 *
 * @throws AlphaVantageError 回應為錯誤或查無報價時
 */
export function toStock(payload: Payload, symbol: string, retrievedAt: number): Stock {
  const apiError = detectApiError(payload)
  if (apiError) throw apiError

  const quote = payload['Global Quote']
  if (!quote || typeof quote !== 'object' || Object.keys(quote).length === 0) {
    throw new AlphaVantageError(
      'empty-response',
      `找不到 ${symbol.toUpperCase()} 的報價，請確認是否為美股代碼。`,
    )
  }

  const q = quote as Payload
  const price = parseFundamental(q['05. price'])
  if (price === null) {
    throw new AlphaVantageError('empty-response', `${symbol.toUpperCase()} 的報價欄位為空。`)
  }

  // 漲跌幅欄位長得像 "1.2345%"，去掉百分號後才是數字
  const rawChangePercent = q['10. change percent']
  const changePercent =
    typeof rawChangePercent === 'string'
      ? parseFundamental(rawChangePercent.replace('%', ''))
      : parseFundamental(rawChangePercent)

  return {
    symbol: symbol.toUpperCase(),
    // GLOBAL_QUOTE 不含公司名稱，用代碼頂替並由呼叫端視需要覆寫
    name: symbol.toUpperCase(),
    price,
    change: parseFundamental(q['09. change']) ?? 0,
    changePercent: changePercent ?? 0,
    type: 'STOCK',
    lastUpdate: retrievedAt,
  }
}
