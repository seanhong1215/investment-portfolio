/**
 * 本地存儲服務
 *
 * 這個服務負責在 IndexedDB 中持久化數據
 * 支持未來遷移到 Firebase 或其他後端
 *
 * 分層設計：
 * - 現在：IndexedDB（本地存儲）
 * - 未來：可輕鬆替換為 Firebase 或其他後端
 */

import { Portfolio, RecurringInvestmentPlan, RebalanceAlert, InvestmentGoal } from '@/types'
import { isFirebaseConfigured } from './firebase'
import { FirestoreStorageService } from './firestoreStorage'
import { useStorageStatusStore } from '@/stores/storageStatusStore'

/**
 * IndexedDB 存儲服務類
 */
class StorageService {
  // 數據庫名稱
  private dbName = 'InvestmentPortfolioAdvisor'

  // 數據庫版本
  private dbVersion = 2

  // 所有數據庫表名稱
  private stores = {
    portfolios: 'portfolios',           // 投資組合
    recurringPlans: 'recurringPlans',   // 定期定額計劃
    alerts: 'alerts',                   // 加碼提醒
    watchlist: 'watchlist',             // 觀察清單
    settings: 'settings',               // 應用設置
    goals: 'goals',                     // 投資目標
  }

  // 數據庫連接（被緩存以供後續使用）
  private db: IDBDatabase | null = null

  /**
   * 初始化存儲服務
   * 打開或創建 IndexedDB 數據庫
   */
  async init(): Promise<void> {
    // 如果已經初始化，跳過
    if (this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      // 打開或創建數據庫
      const request = indexedDB.open(this.dbName, this.dbVersion)

      /**
       * 事件：數據庫升級（第一次創建或版本改變時觸發）
       */
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 創建 portfolios 表
        if (!db.objectStoreNames.contains(this.stores.portfolios)) {
          db.createObjectStore(this.stores.portfolios, { keyPath: 'id' })
        }

        // 創建 recurringPlans 表
        if (!db.objectStoreNames.contains(this.stores.recurringPlans)) {
          db.createObjectStore(this.stores.recurringPlans, { keyPath: 'id' })
        }

        // 創建 alerts 表
        if (!db.objectStoreNames.contains(this.stores.alerts)) {
          db.createObjectStore(this.stores.alerts, { keyPath: 'id' })
        }

        // 創建 watchlist 表
        if (!db.objectStoreNames.contains(this.stores.watchlist)) {
          db.createObjectStore(this.stores.watchlist, { keyPath: 'id' })
        }

        // 創建 settings 表
        if (!db.objectStoreNames.contains(this.stores.settings)) {
          db.createObjectStore(this.stores.settings, { keyPath: 'key' })
        }

        // 創建 goals 表（v2 新增）
        if (!db.objectStoreNames.contains(this.stores.goals)) {
          db.createObjectStore(this.stores.goals, { keyPath: 'id' })
        }

        console.log('✅ 數據庫已初始化')
      }

      /**
       * 事件：數據庫成功打開
       */
      request.onsuccess = () => {
        this.db = request.result
        console.log('✅ 數據庫連接成功')
        resolve()
      }

      /**
       * 事件：數據庫打開失敗
       */
      request.onerror = () => {
        console.error('❌ 數據庫連接失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * ===== 投資組合操作 =====
   */

  /**
   * 保存投資組合
   * @param portfolio 要保存的投資組合
   */
  async savePortfolio(portfolio: Portfolio): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.portfolios], 'readwrite')
      const store = transaction.objectStore(this.stores.portfolios)
      const request = store.put(portfolio)

      request.onsuccess = () => {
        console.log(`✅ 投資組合 ${portfolio.name} 已保存`)
        resolve()
      }

      request.onerror = () => {
        console.error('❌ 保存投資組合失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 獲取所有投資組合
   * @returns 投資組合數組
   */
  async getAllPortfolios(): Promise<Portfolio[]> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.portfolios], 'readonly')
      const store = transaction.objectStore(this.stores.portfolios)
      const request = store.getAll()

      request.onsuccess = () => {
        console.log(`✅ 獲取 ${request.result.length} 個投資組合`)
        resolve(request.result)
      }

      request.onerror = () => {
        console.error('❌ 獲取投資組合失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 獲取單個投資組合
   * @param id 投資組合 ID
   * @returns 投資組合或 null
   */
  async getPortfolio(id: string): Promise<Portfolio | null> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.portfolios], 'readonly')
      const store = transaction.objectStore(this.stores.portfolios)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        console.error('❌ 獲取投資組合失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 刪除投資組合
   * @param id 投資組合 ID
   */
  async deletePortfolio(id: string): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.portfolios], 'readwrite')
      const store = transaction.objectStore(this.stores.portfolios)
      const request = store.delete(id)

      request.onsuccess = () => {
        console.log(`✅ 投資組合 ${id} 已刪除`)
        resolve()
      }

      request.onerror = () => {
        console.error('❌ 刪除投資組合失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * ===== 定期定額計劃操作 =====
   */

  /**
   * 保存定期定額計劃
   * @param plan 要保存的計劃
   */
  async savePlan(plan: RecurringInvestmentPlan): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.recurringPlans], 'readwrite')
      const store = transaction.objectStore(this.stores.recurringPlans)
      const request = store.put(plan)

      request.onsuccess = () => {
        console.log(`✅ 定期投資計劃已保存`)
        resolve()
      }

      request.onerror = () => {
        console.error('❌ 保存計劃失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 獲取某個投資組合的所有計劃
   * @param portfolioId 投資組合 ID
   * @returns 計劃數組
   */
  async getPlansByPortfolio(portfolioId: string): Promise<RecurringInvestmentPlan[]> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.recurringPlans], 'readonly')
      const store = transaction.objectStore(this.stores.recurringPlans)
      const request = store.getAll()

      request.onsuccess = () => {
        const plans = request.result.filter((plan) => plan.portfolioId === portfolioId)
        resolve(plans)
      }

      request.onerror = () => {
        console.error('❌ 獲取計劃失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * ===== 加碼提醒操作 =====
   */

  /**
   * 保存加碼提醒
   * @param alert 要保存的提醒
   */
  async saveAlert(alert: RebalanceAlert): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.alerts], 'readwrite')
      const store = transaction.objectStore(this.stores.alerts)
      const request = store.put(alert)

      request.onsuccess = () => {
        console.log(`✅ 加碼提醒已保存`)
        resolve()
      }

      request.onerror = () => {
        console.error('❌ 保存提醒失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 獲取某個投資組合的未處理提醒
   * @param portfolioId 投資組合 ID
   * @returns 提醒數組
   */
  async getUnhandledAlerts(portfolioId: string): Promise<RebalanceAlert[]> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.alerts], 'readonly')
      const store = transaction.objectStore(this.stores.alerts)
      const request = store.getAll()

      request.onsuccess = () => {
        const alerts = request.result.filter(
          (alert) => alert.portfolioId === portfolioId && !alert.isHandled
        )
        resolve(alerts)
      }

      request.onerror = () => {
        console.error('❌ 獲取提醒失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * ===== 觀察清單操作 =====
   */

  /**
   * 保存觀察清單項目
   * @param item 要保存的項目
   */
  async saveWatchlistItem(item: any): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.watchlist], 'readwrite')
      const store = transaction.objectStore(this.stores.watchlist)
      const request = store.put(item)

      request.onsuccess = () => {
        console.log(`✅ 已保存觀察清單項目：${item.symbol}`)
        resolve()
      }

      request.onerror = () => {
        console.error('❌ 保存觀察清單項目失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 獲取所有觀察清單項目
   * @returns 觀察清單項目數組
   */
  async getWatchlist(): Promise<any[]> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.watchlist], 'readonly')
      const store = transaction.objectStore(this.stores.watchlist)
      const request = store.getAll()

      request.onsuccess = () => {
        console.log(`✅ 獲取 ${request.result.length} 個觀察清單項目`)
        resolve(request.result)
      }

      request.onerror = () => {
        console.error('❌ 獲取觀察清單失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 刪除觀察清單項目
   * @param id 項目 ID
   */
  async deleteWatchlistItem(id: string): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.watchlist], 'readwrite')
      const store = transaction.objectStore(this.stores.watchlist)
      const request = store.delete(id)

      request.onsuccess = () => {
        console.log(`✅ 已刪除觀察清單項目`)
        resolve()
      }

      request.onerror = () => {
        console.error('❌ 刪除觀察清單項目失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * ===== 應用設置操作 =====
   */

  /**
   * 保存應用設置
   * @param key 設置鍵名
   * @param value 設置值
   */
  async saveSetting(key: string, value: any): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.settings], 'readwrite')
      const store = transaction.objectStore(this.stores.settings)
      const request = store.put({ key, value })

      request.onsuccess = () => {
        console.log(`✅ 設置 ${key} 已保存`)
        resolve()
      }

      request.onerror = () => {
        console.error('❌ 保存設置失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 獲取應用設置
   * @param key 設置鍵名
   * @returns 設置值或 null
   */
  async getSetting(key: string): Promise<any> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.settings], 'readonly')
      const store = transaction.objectStore(this.stores.settings)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result?.value || null)
      }

      request.onerror = () => {
        console.error('❌ 獲取設置失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * ===== 投資目標操作 =====
   */

  async saveGoal(goal: InvestmentGoal): Promise<void> {
    await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.goals], 'readwrite')
      const store = transaction.objectStore(this.stores.goals)
      const request = store.put(goal)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getAllGoals(): Promise<InvestmentGoal[]> {
    await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.goals], 'readonly')
      const store = transaction.objectStore(this.stores.goals)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteGoal(id: string): Promise<void> {
    await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.goals], 'readwrite')
      const store = transaction.objectStore(this.stores.goals)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * ===== 數據庫管理 =====
   */

  /**
   * 清除所有數據
   * 用於重置應用
   */
  async clearAll(): Promise<void> {
    await this.init()

    // 清除所有表
    for (const storeName of Object.values(this.stores)) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }

    console.log('🧹 已清除所有數據')
  }

  /**
   * 導出所有數據為 JSON
   * 用於備份
   */
  async exportData(): Promise<any> {
    const data: any = {}

    for (const [key, storeName] of Object.entries(this.stores)) {
      const items = await new Promise<any[]>((resolve, reject) => {
        this.init().then(() => {
          const transaction = this.db!.transaction([storeName], 'readonly')
          const store = transaction.objectStore(storeName)
          const request = store.getAll()

          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      })

      data[key] = items
    }

    return data
  }

  /**
   * 導入 JSON 數據
   * @param data 要導入的數據
   */
  async importData(data: any): Promise<void> {
    await this.init()

    for (const [key, items] of Object.entries(data)) {
      const storeName = this.stores[key as keyof typeof this.stores]

      if (storeName && Array.isArray(items)) {
        for (const item of items) {
          await new Promise<void>((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite')
            const store = transaction.objectStore(storeName)
            const request = store.put(item)

            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
          })
        }
      }
    }

    console.log('✅ 數據導入成功')
  }
}

/**
 * StorageProxy — 延遲初始化存儲後端
 *
 * 執行流程：
 * 1. Firebase 已配置 → 嘗試初始化 FirestoreStorageService
 * 2. Firebase 初始化成功 → 使用 Firestore（雲端同步）
 * 3. Firebase 初始化失敗 → 自動回退到 IndexedDB（本地）
 * 4. Firebase 未配置 → 直接使用 IndexedDB
 *
 * 所有存儲操作都等待後端初始化完成後才執行
 */
class StorageProxy {
  private _init: Promise<StorageService | FirestoreStorageService> | null = null

  /** 取得（或初始化）後端服務 */
  private backend(): Promise<StorageService | FirestoreStorageService> {
    if (!this._init) {
      this._init = (async () => {
        if (isFirebaseConfigured) {
          try {
            const fs = new FirestoreStorageService()
            await fs.init()
            useStorageStatusStore.getState().setStatus('firestore')
            return fs
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.warn('⚠️ Firebase 初始化失敗，回退到本地 IndexedDB:', msg)
            useStorageStatusStore.getState().setStatus('indexeddb', msg)
          }
        } else {
          useStorageStatusStore.getState().setStatus('indexeddb')
        }
        return new StorageService()
      })()
    }
    return this._init
  }

  async init() { await this.backend() }

  // ===== 投資組合 =====
  async savePortfolio(p: Portfolio) { return (await this.backend()).savePortfolio(p) }
  async getAllPortfolios() { return (await this.backend()).getAllPortfolios() }
  async getPortfolio(id: string) { return (await this.backend()).getPortfolio(id) }
  async deletePortfolio(id: string) { return (await this.backend()).deletePortfolio(id) }

  // ===== 定期定額計劃 =====
  async savePlan(plan: RecurringInvestmentPlan) { return (await this.backend()).savePlan(plan) }
  async getPlansByPortfolio(id: string) { return (await this.backend()).getPlansByPortfolio(id) }

  // ===== 加碼提醒 =====
  async saveAlert(alert: RebalanceAlert) { return (await this.backend()).saveAlert(alert) }
  async getUnhandledAlerts(id: string) { return (await this.backend()).getUnhandledAlerts(id) }

  // ===== 觀察清單 =====
  async saveWatchlistItem(item: any) { return (await this.backend()).saveWatchlistItem(item) }
  async getWatchlist() { return (await this.backend()).getWatchlist() }
  async deleteWatchlistItem(id: string) { return (await this.backend()).deleteWatchlistItem(id) }

  // ===== 投資目標 =====
  async saveGoal(goal: InvestmentGoal) { return (await this.backend()).saveGoal(goal) }
  async getAllGoals() { return (await this.backend()).getAllGoals() }
  async deleteGoal(id: string) { return (await this.backend()).deleteGoal(id) }

  // ===== 應用設置 =====
  async saveSetting(key: string, value: any) { return (await this.backend()).saveSetting(key, value) }
  async getSetting(key: string) { return (await this.backend()).getSetting(key) }

  // ===== 資料管理 =====
  async clearAll() { return (await this.backend()).clearAll() }
  async exportData() { return (await this.backend()).exportData() }
  async importData(data: any) { return (await this.backend()).importData(data) }
}

export const storageService = new StorageProxy()

export default storageService
