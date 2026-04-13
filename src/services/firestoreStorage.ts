/**
 * Firestore 雲端存儲服務
 *
 * 使用 Firebase 匿名登入取得用戶 ID，
 * 將所有資料存放於 Firestore：
 *   users/{uid}/portfolios/{id}
 *   users/{uid}/watchlist/{id}
 *   users/{uid}/goals/{id}
 *   users/{uid}/settings/{key}
 *   users/{uid}/recurringPlans/{id}
 *   users/{uid}/alerts/{id}
 *
 * ⚠️ Firestore 安全規則（請在 Firebase Console 設定）：
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if request.auth != null
 *                            && request.auth.uid == userId;
 *       }
 *     }
 *   }
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore'
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { auth, db } from './firebase'
import type {
  Portfolio,
  RecurringInvestmentPlan,
  RebalanceAlert,
  InvestmentGoal,
} from '@/types'

type ColName =
  | 'portfolios'
  | 'watchlist'
  | 'goals'
  | 'settings'
  | 'recurringPlans'
  | 'alerts'

/**
 * Firestore 不接受 undefined 值，用 JSON 序列化去除所有 undefined 欄位
 */
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}

export class FirestoreStorageService {
  private userId: string | null = null
  private readonly authReady: Promise<void>

  constructor() {
    this.authReady = new Promise<void>((resolve, reject) => {
      if (!auth || !db) {
        reject(new Error('Firebase 尚未初始化'))
        return
      }

      // 等待 Firebase 恢復上次的登入狀態（最多觸發一次）
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe()
        if (user) {
          this.userId = user.uid
          console.log(`✅ 雲端同步就緒（UID: ${user.uid.slice(0, 8)}…）`)
          resolve()
        } else {
          try {
            const { user: anon } = await signInAnonymously(auth!)
            this.userId = anon.uid
            console.log(`✅ 匿名登入成功（UID: ${anon.uid.slice(0, 8)}…）`)
            resolve()
          } catch (err) {
            console.error('❌ 匿名登入失敗:', err)
            reject(err)
          }
        }
      })
    })
  }

  async init(): Promise<void> {
    await this.authReady
  }

  private col(name: ColName) {
    return collection(db!, 'users', this.userId!, name)
  }

  private ref(colName: ColName, id: string) {
    return doc(db!, 'users', this.userId!, colName, id)
  }

  // ===== 投資組合 =====

  async savePortfolio(portfolio: Portfolio): Promise<void> {
    await this.init()
    await setDoc(this.ref('portfolios', portfolio.id), stripUndefined(portfolio))
  }

  async getAllPortfolios(): Promise<Portfolio[]> {
    await this.init()
    const snap = await getDocs(this.col('portfolios'))
    return snap.docs.map((d) => d.data() as Portfolio)
  }

  async getPortfolio(id: string): Promise<Portfolio | null> {
    await this.init()
    const snap = await getDoc(this.ref('portfolios', id))
    return snap.exists() ? (snap.data() as Portfolio) : null
  }

  async deletePortfolio(id: string): Promise<void> {
    await this.init()
    await deleteDoc(this.ref('portfolios', id))
  }

  // ===== 定期定額計劃 =====

  async savePlan(plan: RecurringInvestmentPlan): Promise<void> {
    await this.init()
    await setDoc(this.ref('recurringPlans', plan.id), stripUndefined(plan))
  }

  async getPlansByPortfolio(portfolioId: string): Promise<RecurringInvestmentPlan[]> {
    await this.init()
    const snap = await getDocs(this.col('recurringPlans'))
    return snap.docs
      .map((d) => d.data() as RecurringInvestmentPlan)
      .filter((p) => p.portfolioId === portfolioId)
  }

  // ===== 加碼提醒 =====

  async saveAlert(alert: RebalanceAlert): Promise<void> {
    await this.init()
    await setDoc(this.ref('alerts', alert.id), stripUndefined(alert))
  }

  async getUnhandledAlerts(portfolioId: string): Promise<RebalanceAlert[]> {
    await this.init()
    const snap = await getDocs(this.col('alerts'))
    return snap.docs
      .map((d) => d.data() as RebalanceAlert)
      .filter((a) => a.portfolioId === portfolioId && !a.isHandled)
  }

  // ===== 觀察清單 =====

  async saveWatchlistItem(item: any): Promise<void> {
    await this.init()
    await setDoc(this.ref('watchlist', item.id), stripUndefined(item))
  }

  async getWatchlist(): Promise<any[]> {
    await this.init()
    const snap = await getDocs(this.col('watchlist'))
    return snap.docs.map((d) => d.data())
  }

  async deleteWatchlistItem(id: string): Promise<void> {
    await this.init()
    await deleteDoc(this.ref('watchlist', id))
  }

  // ===== 投資目標 =====

  async saveGoal(goal: InvestmentGoal): Promise<void> {
    await this.init()
    await setDoc(this.ref('goals', goal.id), stripUndefined(goal))
  }

  async getAllGoals(): Promise<InvestmentGoal[]> {
    await this.init()
    const snap = await getDocs(this.col('goals'))
    return snap.docs.map((d) => d.data() as InvestmentGoal)
  }

  async deleteGoal(id: string): Promise<void> {
    await this.init()
    await deleteDoc(this.ref('goals', id))
  }

  // ===== 應用設置 =====

  async saveSetting(key: string, value: any): Promise<void> {
    await this.init()
    await setDoc(this.ref('settings', key), stripUndefined({ key, value }))
  }

  async getSetting(key: string): Promise<any> {
    await this.init()
    const snap = await getDoc(this.ref('settings', key))
    return snap.exists() ? snap.data().value : null
  }

  // ===== 資料管理 =====

  async clearAll(): Promise<void> {
    await this.init()
    const cols: ColName[] = ['portfolios', 'watchlist', 'goals', 'settings', 'recurringPlans', 'alerts']
    const batch = writeBatch(db!)
    for (const colName of cols) {
      const snap = await getDocs(this.col(colName))
      snap.docs.forEach((d) => batch.delete(d.ref))
    }
    await batch.commit()
  }

  async exportData(): Promise<any> {
    await this.init()
    const cols: ColName[] = ['portfolios', 'watchlist', 'goals', 'settings', 'recurringPlans', 'alerts']
    const data: any = {}
    for (const colName of cols) {
      const snap = await getDocs(this.col(colName))
      data[colName] = snap.docs.map((d) => d.data())
    }
    return data
  }

  async importData(data: any): Promise<void> {
    await this.init()
    const batch = writeBatch(db!)
    for (const [colName, items] of Object.entries(data)) {
      if (Array.isArray(items)) {
        for (const item of items as any[]) {
          const id: string = item.id ?? item.key
          if (id) {
            batch.set(doc(db!, 'users', this.userId!, colName, id), item)
          }
        }
      }
    }
    await batch.commit()
  }

  get currentUserId(): string | null {
    return this.userId
  }
}
