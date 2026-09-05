/**
 * Alpha Vantage 用戶端 —— 這一層只負責 I/O：組 URL、發請求、節流、快取。
 * 所有欄位對應與錯誤判讀都在 mapping.ts（純函數、有測試）。
 *
 * ## 節流為什麼要序列化
 *
 * 重構前的節流是這樣寫的：
 *
 *     const since = Date.now() - this.lastRequestTime
 *     if (since < INTERVAL) await sleep(INTERVAL - since)
 *     this.lastRequestTime = Date.now()
 *
 * 在單一請求下看起來沒問題，但 `getStocksBySymbols` 是用
 * `Promise.allSettled(symbols.map(...))` 同時發動的 —— 五個呼叫在同一個
 * tick 讀到**同一個** `lastRequestTime`，全部通過檢查後一起送出。
 * 也就是說限流器在唯一需要它的情境（批次查詢）下完全失效，直接撞上
 * 每分鐘 5 次的上限。
 *
 * 現在改成一條 promise 鏈：每個任務都排在前一個之後，間隔由鏈本身保證，
 * 併發呼叫會自動排隊而不是各自為政。
 */

import type { CompanyOverview, Stock } from '@/types'
import { AlphaVantageError, toCompanyOverview, toStock } from './mapping'
import { TtlCache } from './ttlCache'

/** 免費方案每分鐘 5 次 → 兩次請求至少間隔 12 秒 */
const REQUEST_INTERVAL_MS = 12_000

/** 報價 30 分鐘。盤中會變動，但配額比即時性重要 */
const QUOTE_TTL_MS = 30 * 60 * 1000

/** 基本面 2 小時。這是季報級資料，一天內不會變 */
const OVERVIEW_TTL_MS = 2 * 60 * 60 * 1000

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface AlphaVantageClientOptions {
  baseUrl?: string
  apiKey?: string
  now?: () => number
  /** 請求間隔。測試會調小，正式環境用 REQUEST_INTERVAL_MS */
  intervalMs?: number
}

export class AlphaVantageClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly intervalMs: number
  private readonly quotes: TtlCache<Stock>
  private readonly overviews: TtlCache<CompanyOverview>

  /** 排隊用的 promise 鏈；節流靠它而非共享的時間戳 */
  private gate: Promise<unknown> = Promise.resolve()
  private lastRequestAt = 0

  constructor(options: AlphaVantageClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? 'https://www.alphavantage.co'
    this.apiKey = options.apiKey ?? import.meta.env.VITE_ALPHA_VANTAGE_API_KEY ?? ''
    this.intervalMs = options.intervalMs ?? REQUEST_INTERVAL_MS
    this.quotes = new TtlCache<Stock>(QUOTE_TTL_MS, options.now)
    this.overviews = new TtlCache<CompanyOverview>(OVERVIEW_TTL_MS, options.now)
  }

  get isConfigured(): boolean {
    return this.apiKey !== ''
  }

  /**
   * 把任務排進節流佇列。
   *
   * `gate` 只用來決定「何時輪到下一個」，所以要吞掉前一個任務的失敗 ——
   * 否則一次請求失敗就會讓整條鏈變成 rejected，之後每個請求都被連帶拒絕。
   */
  private schedule<T>(task: () => Promise<T>): Promise<T> {
    const result = this.gate.then(async () => {
      const wait = this.lastRequestAt + this.intervalMs - Date.now()
      if (wait > 0) await delay(wait)
      this.lastRequestAt = Date.now()
      return task()
    })

    this.gate = result.catch(() => undefined)
    return result
  }

  private async request(params: Record<string, string>): Promise<Record<string, unknown>> {
    if (!this.isConfigured) {
      throw new AlphaVantageError(
        'invalid-key',
        'Alpha Vantage API 金鑰未設定\n請在 .env 設定 VITE_ALPHA_VANTAGE_API_KEY，或改用手動輸入模式。',
      )
    }

    const url = new URL('/query', this.baseUrl)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    url.searchParams.set('apikey', this.apiKey)

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new AlphaVantageError('empty-response', `API 請求失敗（HTTP ${response.status}）`)
    }

    // 注意：Alpha Vantage 對錯誤也回 200，真正的判讀在 mapping.detectApiError
    return (await response.json()) as Record<string, unknown>
  }

  /** 取得即時報價 */
  async getQuote(symbol: string): Promise<Stock> {
    const key = symbol.trim().toUpperCase()

    const cached = this.quotes.get(key)
    if (cached) return cached

    const payload = await this.schedule(() =>
      this.request({ function: 'GLOBAL_QUOTE', symbol: key }),
    )
    const stock = toStock(payload, key, Date.now())

    this.quotes.set(key, stock)
    return stock
  }

  /**
   * 批次取得報價。
   *
   * 個別失敗不影響其他標的 —— 一檔下市的股票不該讓整個組合都讀不到報價。
   * 請求本身仍受 `schedule` 序列化，不會一次全送出。
   */
  async getQuotes(symbols: string[]): Promise<Stock[]> {
    const results = await Promise.allSettled(symbols.map((s) => this.getQuote(s)))
    return results
      .filter((r): r is PromiseFulfilledResult<Stock> => r.status === 'fulfilled')
      .map((r) => r.value)
  }

  /** 取得公司基本面 */
  async getCompanyOverview(symbol: string): Promise<CompanyOverview> {
    const key = symbol.trim().toUpperCase()

    const cached = this.overviews.get(key)
    if (cached) return cached

    const payload = await this.schedule(() => this.request({ function: 'OVERVIEW', symbol: key }))
    const overview = toCompanyOverview(payload, Date.now())

    this.overviews.set(key, overview)
    return overview
  }

  clearCache(): void {
    this.quotes.clear()
    this.overviews.clear()
  }
}

/** 應用共用的單例。測試請自行 `new AlphaVantageClient({ ... })` 注入設定 */
export const alphaVantageClient = new AlphaVantageClient()
