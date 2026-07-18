/**
 * 儲存層入口 — 選擇後端並在雲端不可用時退回本地。
 *
 * 決策順序：
 *   1. 有 Firebase 設定 → 嘗試 Firestore（跨裝置同步）
 *   2. Firestore 初始化失敗 → 退回 IndexedDB，並把原因寫進狀態供 UI 顯示
 *   3. 沒有 Firebase 設定 → 直接用 IndexedDB
 *
 * 退回而非丟錯，是因為這個應用沒有雲端也完全能用；
 * 讓使用者因為別人的 Firebase 專案沒設好就看到白畫面並不合理。
 */

import type { Portfolio } from '@/types'
import type { PortfolioRepository } from './portfolioRepository'
import { IndexedDbRepository } from './indexedDbRepository'
import { isFirebaseConfigured } from './firebaseConfig'
import { useStorageStatusStore } from '@/stores/storageStatusStore'

class StorageService implements PortfolioRepository {
  private resolving: Promise<PortfolioRepository> | null = null

  /** 快取初始化 Promise，確保後端只被選擇一次 */
  private backend(): Promise<PortfolioRepository> {
    if (this.resolving) return this.resolving

    this.resolving = (async () => {
      if (!isFirebaseConfigured) {
        useStorageStatusStore.getState().setStatus('indexeddb')
        return new IndexedDbRepository()
      }

      try {
        // 動態載入：Firebase SDK 只在確實要用雲端時才進 bundle
        const { FirestoreRepository } = await import('./firestoreRepository')
        const firestore = new FirestoreRepository()
        await firestore.init()
        useStorageStatusStore.getState().setStatus('firestore')
        return firestore
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn('雲端同步初始化失敗，改用本地儲存：', message)
        useStorageStatusStore.getState().setStatus('indexeddb', message)
        return new IndexedDbRepository()
      }
    })()

    return this.resolving
  }

  async init(): Promise<void> {
    await this.backend()
  }

  async save(portfolio: Portfolio): Promise<void> {
    return (await this.backend()).save(portfolio)
  }

  async getAll(): Promise<Portfolio[]> {
    return (await this.backend()).getAll()
  }

  async get(id: string): Promise<Portfolio | null> {
    return (await this.backend()).get(id)
  }

  async remove(id: string): Promise<void> {
    return (await this.backend()).remove(id)
  }
}

export const storageService = new StorageService()
