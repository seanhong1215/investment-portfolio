import { describe, it, expect } from 'vitest'
import { TtlCache } from './ttlCache'

/**
 * 時間由建構子注入，所以過期行為可以直接驗證，不需要 fake timers，
 * 也不需要真的等 30 分鐘。
 */
function makeClock(start = 0) {
  let now = start
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms
    },
  }
}

describe('TtlCache', () => {
  it('存活期間內取得存入的值', () => {
    const clock = makeClock()
    const cache = new TtlCache<string>(1000, clock.now)

    cache.set('AAPL', 'quote')
    clock.advance(999)

    expect(cache.get('AAPL')).toBe('quote')
  })

  it('達到存活時間就視為過期', () => {
    // 邊界取「>=」：剛好到期的資料已經不該再用。
    const clock = makeClock()
    const cache = new TtlCache<string>(1000, clock.now)

    cache.set('AAPL', 'quote')
    clock.advance(1000)

    expect(cache.get('AAPL')).toBeNull()
  })

  it('未存入的鍵回傳 null', () => {
    expect(new TtlCache<string>(1000).get('NOPE')).toBeNull()
  })

  it('重新寫入會重置存活時間', () => {
    const clock = makeClock()
    const cache = new TtlCache<string>(1000, clock.now)

    cache.set('AAPL', 'v1')
    clock.advance(900)
    cache.set('AAPL', 'v2')
    clock.advance(900)

    expect(cache.get('AAPL')).toBe('v2')
  })

  it('讀到過期項目時順手清掉，長時間執行的分頁才不會無限累積', () => {
    const clock = makeClock()
    const cache = new TtlCache<string>(1000, clock.now)

    cache.set('AAPL', 'quote')
    clock.advance(1001)
    cache.get('AAPL')

    expect(cache.size).toBe(0)
  })

  it('size 只算仍然有效的項目', () => {
    const clock = makeClock()
    const cache = new TtlCache<string>(1000, clock.now)

    cache.set('A', '1')
    clock.advance(600)
    cache.set('B', '2')
    clock.advance(600) // A 已過期（1200），B 尚未（600）

    expect(cache.size).toBe(1)
  })

  it('clear 清空所有項目', () => {
    const cache = new TtlCache<string>(1000)
    cache.set('A', '1')
    cache.clear()

    expect(cache.get('A')).toBeNull()
  })
})
