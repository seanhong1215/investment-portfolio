import type { Portfolio } from '@/types'

/**
 * 投資組合儲存介面。
 *
 * 為什麼要有這個介面：原本 IndexedDB 與 Firestore 兩個實作只是「碰巧」
 * 有同名方法，沒有任何型別關係。任一邊改了簽章、或漏實作一個方法，
 * TypeScript 都不會出聲，要等到執行時切換後端才會炸。
 * 明確宣告介面後，兩個實作都必須 implements 它，編譯期就會擋下來。
 */
export interface PortfolioRepository {
  /** 建立連線／完成認證。重複呼叫應為無副作用 */
  init(): Promise<void>
  save(portfolio: Portfolio): Promise<void>
  getAll(): Promise<Portfolio[]>
  get(id: string): Promise<Portfolio | null>
  remove(id: string): Promise<void>
}
