/**
 * 帶存活時間的記憶體快取。
 *
 * 免費 API 每日只有 25 次配額，快取不是效能優化而是功能的一部分 ——
 * 沒有它，使用者點兩次同一檔股票就燒掉兩次配額。
 *
 * 時間來源由建構子注入（預設 `Date.now`），讓「過期」這件事可以被測試
 * 直接驗證，而不必真的等 30 分鐘或去 mock 全域計時器。
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; storedAt: number }>()

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | null {
    const entry = this.entries.get(key)
    if (!entry) return null

    if (this.now() - entry.storedAt >= this.ttlMs) {
      // 過期的項目直接刪掉，否則長時間執行的分頁會無限累積
      this.entries.delete(key)
      return null
    }

    return entry.value
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, storedAt: this.now() })
  }

  clear(): void {
    this.entries.clear()
  }

  /** 目前有效項目數（過期但尚未被讀取的項目不計入） */
  get size(): number {
    let count = 0
    for (const [key] of this.entries) {
      if (this.get(key) !== null) count++
    }
    return count
  }
}
