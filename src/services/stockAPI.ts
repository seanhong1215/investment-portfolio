/**
 * Stock API 服務
 *
 * 這個服務負責從 Alpha Vantage API 獲取股票數據
 * 並實現本地緩存機制以避免頻繁調用 API
 *
 * 免費 API 限制：每分鐘 5 個請求，每天 500 個請求
 * 所以緩存非常重要！
 */

import { Stock, CompanyOverview } from '@/types'

/**
 * 緩存項目類型
 * 存儲數據和過期時間
 */
interface CacheItem<T> {
  // 緩存的數據
  data: T
  // 存儲時間戳
  timestamp: number
}

/**
 * 股票 API 服務類
 * 管理股票數據獲取和緩存
 */
class StockAPIService {
  // API 基礎 URL
  private baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://www.alphavantage.co'

  // API 密鑰（從環境變量讀取）
  private apiKey = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY

  // 本地緩存存儲（在內存中）
  private cache = new Map<string, CacheItem<Stock>>()

  // 公司基本面緩存（過期時間較長：2 小時）
  private overviewCache = new Map<string, CacheItem<CompanyOverview>>()
  private OVERVIEW_CACHE_DURATION = 2 * 60 * 60 * 1000

  // 緩存過期時間：30 分鐘（毫秒）
  private CACHE_DURATION = 30 * 60 * 1000

  // API 請求之間的最小間隔（毫秒）
  // 防止超過免費 API 限制（每分鐘 5 個請求）
  private REQUEST_INTERVAL = 12000 // 12 秒

  // 上一次 API 請求的時間
  private lastRequestTime = 0

  /**
   * 初始化服務
   * 檢查是否有可用的 API 密鑰
   */
  constructor() {
    if (!this.apiKey) {
      console.warn(
        '⚠️ Alpha Vantage API 密鑰未設置！' +
        '請在 .env 文件中設置 VITE_ALPHA_VANTAGE_API_KEY' +
        '從 https://www.alphavantage.co 獲取免費密鑰'
      )
    }
  }

  /**
   * 等待 API 限流
   * 確保請求不超過免費 API 限制
   */
  private async waitForRateLimit(): Promise<void> {
    // 計算自上次請求以來經過的時間
    const timeSinceLastRequest = Date.now() - this.lastRequestTime

    // 如果時間不足，睡眠直到可以發送下一個請求
    if (timeSinceLastRequest < this.REQUEST_INTERVAL) {
      const waitTime = this.REQUEST_INTERVAL - timeSinceLastRequest
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    // 更新上次請求時間
    this.lastRequestTime = Date.now()
  }

  /**
   * 獲取緩存中的股票數據
   * @param symbol 股票代碼（如 AAPL）
   * @returns 緩存的股票數據或 null
   */
  private getFromCache(symbol: string): Stock | null {
    const cacheKey = `stock_${symbol}`
    const cachedItem = this.cache.get(cacheKey)

    // 如果沒有緩存數據，返回 null
    if (!cachedItem) {
      return null
    }

    // 檢查緩存是否過期
    const isExpired = Date.now() - cachedItem.timestamp > this.CACHE_DURATION

    if (isExpired) {
      // 刪除過期的緩存
      this.cache.delete(cacheKey)
      return null
    }

    // 返回有效的緩存數據
    return cachedItem.data
  }

  /**
   * 將股票數據保存到緩存
   * @param symbol 股票代碼
   * @param stock 股票數據
   */
  private saveToCache(symbol: string, stock: Stock): void {
    const cacheKey = `stock_${symbol}`
    this.cache.set(cacheKey, {
      data: stock,
      timestamp: Date.now(),
    })
  }

  /**
   * 從 Alpha Vantage API 獲取股票數據
   *
   * @param symbol 股票代碼（如 AAPL、MSFT）
   * @returns 股票對象
   * @throws 如果 API 請求失敗
   */
  async getStockBySymbol(symbol: string): Promise<Stock> {
    // 首先檢查緩存
    const cachedStock = this.getFromCache(symbol)
    if (cachedStock) {
      console.log(`📦 從緩存獲取 ${symbol}`)
      return cachedStock
    }

    console.log(`🔄 從 API 獲取 ${symbol}...`)

    // 等待 API 限流
    await this.waitForRateLimit()

    try {
      // 構建 API 請求 URL
      // 使用 GLOBAL_QUOTE 端點獲取實時股票信息
      const url = new URL('/query', this.baseUrl)
      url.searchParams.append('function', 'GLOBAL_QUOTE')
      url.searchParams.append('symbol', symbol)
      url.searchParams.append('apikey', this.apiKey)

      // 發送 API 請求
      const response = await fetch(url.toString())

      // 檢查響應是否成功
      if (!response.ok) {
        throw new Error(`API 請求失敗: ${response.statusText}`)
      }

      // 解析 JSON 響應
      const data = await response.json()

      if (data['Error Message']) throw new Error(`股票代碼不存在：${data['Error Message']}`)
      if (data['Note']) throw new Error(`API 請求頻率超過限制（免費版每分鐘 5 次），請稍後再試`)
      if (data['Information']) {
        const info: string = data['Information']
        if (info.includes('rate limit') || info.includes('25 requests') || info.includes('daily'))
          throw new Error(`API 每日請求次數已達上限（免費版每日 25 次），請明天再試或升級 API 方案`)
        if (info.includes('premium'))
          throw new Error(`此端點需要付費 API 金鑰，請至 alphavantage.co 升級方案`)
        throw new Error(`API 金鑰無效或未設定，請確認 .env 中的 VITE_ALPHA_VANTAGE_API_KEY`)
      }

      // 解析全局引號數據
      const quotes = data['Global Quote']

      if (!quotes || Object.keys(quotes).length === 0) {
        throw new Error(`找不到股票代碼：${symbol}，請確認是否為美股代碼`)
      }

      /**
       * 構造 Stock 對象
       * Alpha Vantage API 的字段映射到我們的 Stock 類型
       */
      const stock: Stock = {
        symbol: symbol.toUpperCase(),
        name: symbol, // API 不提供名稱，使用符號作為備選
        price: parseFloat(quotes['05. price'] || '0'),
        change: parseFloat(quotes['09. change'] || '0'),
        changePercent: parseFloat(quotes['10. change percent']?.replace('%', '') || '0'),
        type: 'STOCK', // 默認為個股，可後續修改
        lastUpdate: Date.now(),
      }

      // 將數據保存到緩存
      this.saveToCache(symbol, stock)

      console.log(`✅ 成功獲取 ${symbol}: $${stock.price}`)
      return stock
    } catch (error) {
      console.error(`❌ 獲取 ${symbol} 失敗:`, error)
      throw error
    }
  }

  /**
   * 批量獲取多個股票的數據
   * @param symbols 股票代碼數組
   * @returns 股票數組
   */
  async getStocksBySymbols(symbols: string[]): Promise<Stock[]> {
    // 逐個獲取每個股票的數據
    const stocks = await Promise.allSettled(
      symbols.map((symbol) => this.getStockBySymbol(symbol))
    )

    // 過濾成功的結果
    return stocks
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<Stock>).value)
  }

  /**
   * 從 Alpha Vantage OVERVIEW 端點獲取公司基本面數據
   * 用於巴菲特選股分析
   */
  async getCompanyOverview(symbol: string): Promise<CompanyOverview> {
    const cacheKey = `overview_${symbol.toUpperCase()}`
    const cached = this.overviewCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.OVERVIEW_CACHE_DURATION) {
      console.log(`📦 從緩存獲取 ${symbol} 基本面`)
      return cached.data
    }

    console.log(`🔄 從 API 獲取 ${symbol} 基本面...`)
    await this.waitForRateLimit()

    const url = new URL('/query', this.baseUrl)
    url.searchParams.append('function', 'OVERVIEW')
    url.searchParams.append('symbol', symbol.toUpperCase())
    url.searchParams.append('apikey', this.apiKey)

    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`API 請求失敗: ${response.statusText}`)

    const d = await response.json()
    if (d['Error Message']) throw new Error(`股票代碼不存在：${d['Error Message']}`)
    if (d['Note']) throw new Error(
      `API 請求頻率超過限制（免費版每分鐘 5 次）\n請等待約 1 分鐘後再試。`
    )
    if (d['Information']) {
      const info: string = d['Information']
      if (info.includes('rate limit') || info.includes('25 requests') || info.includes('daily'))
        throw new Error(`API 每日請求次數已達上限（免費版每日 25 次）\n請明天再試，或考慮升級 Alpha Vantage 付費方案`)
      if (info.includes('premium'))
        throw new Error(
          `公司基本面（OVERVIEW）端點需要付費 API 金鑰\n` +
          `免費金鑰目前無法使用此功能，請至 alphavantage.co 升級，或改用其他數據來源`
        )
      throw new Error(`API 金鑰無效或未設定\n請在 .env 檔案中設定 VITE_ALPHA_VANTAGE_API_KEY`)
    }
    if (!d.Symbol) throw new Error(`找不到股票代碼：${symbol}，請確認是否為美股代碼`)

    // ETF 不提供個股基本面（無 EPS、ROE 等），無法進行巴菲特分析
    if (d.AssetType === 'Exchange Traded Fund' || d.AssetType === 'ETF') {
      throw new Error(
        `${symbol} 是 ETF，巴菲特分析僅支援個股（如 AAPL、KO、MSFT）。\n` +
        `ETF 推薦直接定期定額買入，無需選股分析。`
      )
    }

    const parse = (v: string | undefined) => parseFloat(v || '0') || 0

    const overview: CompanyOverview = {
      symbol: d.Symbol,
      name: d.Name || symbol,
      sector: d.Sector || '未知',
      industry: d.Industry || '未知',
      marketCap: parse(d.MarketCapitalization),
      peRatio: parse(d.PERatio),
      pegRatio: parse(d.PEGRatio),
      roe: parse(d.ReturnOnEquityTTM) * 100,
      debtToEquity: parse(d.DebtToEquityRatio),
      profitMargin: parse(d.ProfitMargin) * 100,
      operatingMargin: parse(d.OperatingMarginTTM) * 100,
      revenueGrowthYOY: parse(d.QuarterlyRevenueGrowthYOY) * 100,
      earningsGrowthYOY: parse(d.QuarterlyEarningsGrowthYOY) * 100,
      dividendYield: parse(d.DividendYield) * 100,
      bookValue: parse(d.BookValue),
      priceToBook: parse(d.PriceToBookRatio),
      eps: parse(d.EPS),
      currentRatio: parse(d.CurrentRatio),
      week52High: parse(d['52WeekHigh']),
      week52Low: parse(d['52WeekLow']),
      movingAvg50: parse(d['50DayMovingAverage']),
      movingAvg200: parse(d['200DayMovingAverage']),
      analystTargetPrice: parse(d.AnalystTargetPrice),
    }

    this.overviewCache.set(cacheKey, { data: overview, timestamp: Date.now() })
    console.log(`✅ 成功獲取 ${symbol} 基本面`)
    return overview
  }

  /**
   * 清除所有緩存
   * 用於調試或手動刷新
   */
  clearCache(): void {
    this.cache.clear()
    console.log('🧹 已清除所有緩存')
  }

  /**
   * 獲取緩存統計信息
   * @returns 緩存項目數
   */
  getCacheStats(): number {
    return this.cache.size
  }
}

/**
 * 導出單例實例
 * 整個應用共享同一個服務實例
 */
export const stockAPIService = new StockAPIService()

export default stockAPIService
