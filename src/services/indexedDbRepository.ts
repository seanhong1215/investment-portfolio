/**
 * IndexedDB 實作 — 離線可用的本地後端，同時是雲端連線失敗時的退路。
 */

import type { Portfolio } from '@/types'
import type { PortfolioRepository } from './portfolioRepository'

const DB_NAME = 'InvestmentPortfolioAdvisor'
/**
 * v3：移除 watchlist / goals / recurringPlans / alerts / settings 五個 store。
 * 保留升級路徑而非直接刪庫，既有使用者的投資組合資料不會遺失。
 */
const DB_VERSION = 3
const STORE = 'portfolios'
const REMOVED_STORES = ['watchlist', 'goals', 'recurringPlans', 'alerts', 'settings']

/**
 * 把 IDBRequest 的 onsuccess/onerror 包成 Promise。
 * 原本每個方法都手寫一次這 8 行樣板，五個方法就是 40 行雜訊。
 */
function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export class IndexedDbRepository implements PortfolioRepository {
  private db: IDBDatabase | null = null
  private connecting: Promise<IDBDatabase> | null = null

  /**
   * 並發呼叫時共用同一個連線 Promise。
   * 若不快取 Promise，畫面同時發出的多個請求會各自開一次 DB，
   * 在版本升級時會互相卡住（blocked）。
   */
  private connect(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    if (this.connecting) return this.connecting

    this.connecting = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result

        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }

        // 清掉已移除功能留下的 store，否則它們會一直佔著使用者的磁碟空間
        for (const name of REMOVED_STORES) {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    this.connecting.then(
      (db) => { this.db = db },
      () => { this.connecting = null } // 失敗就清掉，讓下次呼叫能重試
    )

    return this.connecting
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.connect()
    return db.transaction([STORE], mode).objectStore(STORE)
  }

  async init(): Promise<void> {
    await this.connect()
  }

  async save(portfolio: Portfolio): Promise<void> {
    const store = await this.store('readwrite')
    await promisify(store.put(portfolio))
  }

  async getAll(): Promise<Portfolio[]> {
    const store = await this.store('readonly')
    return promisify(store.getAll())
  }

  async get(id: string): Promise<Portfolio | null> {
    const store = await this.store('readonly')
    return (await promisify(store.get(id))) ?? null
  }

  async remove(id: string): Promise<void> {
    const store = await this.store('readwrite')
    await promisify(store.delete(id))
  }
}
