/**
 * Firestore 實作 — 以匿名登入取得 uid，資料存於 users/{uid}/portfolios/{id}。
 *
 * Firestore 安全規則（需在 Firebase Console 設定，否則任何人都能讀別人的資料）：
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if request.auth != null && request.auth.uid == userId;
 *       }
 *     }
 *   }
 */

import { collection, doc, setDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore'
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { auth, db } from './firebase'
import type { Portfolio } from '@/types'
import type { PortfolioRepository } from './portfolioRepository'

const COLLECTION = 'portfolios'

/**
 * Firestore 會對 undefined 欄位直接丟錯，而 Portfolio 有多個選填欄位
 * （description、investmentYears、notes…）。序列化一輪把它們濾掉。
 */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export class FirestoreRepository implements PortfolioRepository {
  private userId: string | null = null
  private readonly authReady: Promise<void>

  constructor() {
    this.authReady = new Promise<void>((resolve, reject) => {
      if (!auth || !db) {
        reject(new Error('Firebase 尚未初始化'))
        return
      }

      // 先等 Firebase 嘗試還原上次的登入狀態，沒有才匿名登入 —
      // 否則每次重整都會拿到新的 uid，使用者的資料就「不見了」。
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe()

        if (user) {
          this.userId = user.uid
          resolve()
          return
        }

        try {
          const { user: anon } = await signInAnonymously(auth!)
          this.userId = anon.uid
          resolve()
        } catch (err) {
          reject(err)
        }
      })
    })
  }

  async init(): Promise<void> {
    await this.authReady
  }

  private col() {
    return collection(db!, 'users', this.userId!, COLLECTION)
  }

  private ref(id: string) {
    return doc(db!, 'users', this.userId!, COLLECTION, id)
  }

  async save(portfolio: Portfolio): Promise<void> {
    await this.init()
    await setDoc(this.ref(portfolio.id), stripUndefined(portfolio))
  }

  async getAll(): Promise<Portfolio[]> {
    await this.init()
    const snap = await getDocs(this.col())
    return snap.docs.map((d) => d.data() as Portfolio)
  }

  async get(id: string): Promise<Portfolio | null> {
    await this.init()
    const snap = await getDoc(this.ref(id))
    return snap.exists() ? (snap.data() as Portfolio) : null
  }

  async remove(id: string): Promise<void> {
    await this.init()
    await deleteDoc(this.ref(id))
  }
}
