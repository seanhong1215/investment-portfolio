/**
 * 用戶端的行為測試 —— 節流、快取、錯誤傳遞。
 *
 * 重點是節流：舊實作在併發下形同虛設，而「併發」正是唯一需要它的情境。
 * 這裡用假的 fetch 記錄每次請求的時間點，直接驗證間隔。
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { AlphaVantageClient } from './client'
import { AlphaVantageError } from './mapping'

const QUOTE_BODY = {
  'Global Quote': {
    '01. symbol': 'AAPL',
    '05. price': '100.00',
    '09. change': '1.00',
    '10. change percent': '1.0000%',
  },
}

/** 記錄每次呼叫的時間點，回傳固定的成功內容 */
function stubFetch(body: unknown = QUOTE_BODY) {
  const calls: number[] = []
  const fetchMock = vi.fn(async () => {
    calls.push(Date.now())
    return { ok: true, status: 200, json: async () => body } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock }
}

/** 測試用的 client：極短間隔，讓節流可以在毫秒尺度上被驗證 */
function makeClient(intervalMs = 40) {
  return new AlphaVantageClient({
    baseUrl: 'https://example.test',
    apiKey: 'test-key',
    intervalMs,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AlphaVantageClient — 節流', () => {
  it('併發呼叫會排隊，而不是同時送出', async () => {
    // 這正是舊實作失效的情境：三個呼叫在同一個 tick 讀到同一個
    // lastRequestTime，全部通過檢查後一起送出，直接撞上每分鐘 5 次上限。
    const interval = 40
    const { calls } = stubFetch()
    const client = makeClient(interval)

    await Promise.all([client.getQuote('AAPL'), client.getQuote('MSFT'), client.getQuote('KO')])

    expect(calls).toHaveLength(3)
    for (let i = 1; i < calls.length; i++) {
      // 留一點時鐘誤差的餘裕，重點是「有明顯間隔」而非精確到毫秒
      expect(calls[i] - calls[i - 1]).toBeGreaterThanOrEqual(interval - 5)
    }
  })

  it('批次查詢同樣受節流保護', async () => {
    const interval = 30
    const { calls } = stubFetch()
    const client = makeClient(interval)

    await client.getQuotes(['AAPL', 'MSFT'])

    expect(calls).toHaveLength(2)
    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(interval - 5)
  })

  it('一次請求失敗不會讓後續所有請求連帶失敗', async () => {
    // gate 若直接接上前一個 promise，一次 reject 就會讓整條鏈變成
    // rejected，之後每個請求都被連帶拒絕。
    const client = makeClient(5)
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call++
        if (call === 1) throw new Error('network down')
        return { ok: true, status: 200, json: async () => QUOTE_BODY } as Response
      }),
    )

    await expect(client.getQuote('AAPL')).rejects.toThrow('network down')
    await expect(client.getQuote('MSFT')).resolves.toMatchObject({ symbol: 'MSFT' })
  })
})

describe('AlphaVantageClient — 快取', () => {
  it('重複查詢同一檔股票不會再打 API（配額是有限的）', async () => {
    const { fetchMock } = stubFetch()
    const client = makeClient(5)

    await client.getQuote('AAPL')
    await client.getQuote('aapl') // 大小寫不同，但是同一檔

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('clearCache 之後會重新查詢', async () => {
    const { fetchMock } = stubFetch()
    const client = makeClient(5)

    await client.getQuote('AAPL')
    client.clearCache()
    await client.getQuote('AAPL')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('AlphaVantageClient — 錯誤', () => {
  it('沒有金鑰時直接拋出可辨識的錯誤，不浪費一次請求', async () => {
    const client = new AlphaVantageClient({ baseUrl: 'https://example.test', apiKey: '' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(client.getCompanyOverview('AAPL')).rejects.toBeInstanceOf(AlphaVantageError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('HTTP 錯誤被包成 AlphaVantageError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response),
    )

    await expect(makeClient(5).getQuote('AAPL')).rejects.toBeInstanceOf(AlphaVantageError)
  })

  it('HTTP 200 但 body 是配額錯誤時仍然拋錯', async () => {
    // Alpha Vantage 對錯誤一律回 200，只看 response.ok 會把錯誤當成成功。
    stubFetch({ Note: 'rate limited' })

    await expect(makeClient(5).getQuote('AAPL')).rejects.toThrowError(/每分鐘/)
  })

  it('失敗的查詢不會被寫進快取', async () => {
    const client = makeClient(5)
    let call = 0
    const fetchMock = vi.fn(async () => {
      call++
      return {
        ok: true,
        status: 200,
        json: async () => (call === 1 ? { Note: 'rate limited' } : QUOTE_BODY),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(client.getQuote('AAPL')).rejects.toThrow()
    await expect(client.getQuote('AAPL')).resolves.toMatchObject({ price: 100 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
