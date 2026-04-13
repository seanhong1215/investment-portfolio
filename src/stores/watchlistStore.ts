/**
 * 觀察清單狀態存儲
 *
 * 使用 Zustand 管理用戶的觀察清單
 * 這允許用戶關注他們感興趣的股票/ETF
 */

import { create } from 'zustand'
import { WatchlistItem } from '@/types'

/**
 * 定義觀察清單存儲的狀態類型
 */
interface WatchlistStore {
  // ===== 狀態 =====
  // 觀察清單中的所有項目
  items: WatchlistItem[]
  // 是否在加載中
  isLoading: boolean
  // 錯誤信息
  error: string | null

  // ===== 動作（修改狀態的方法） =====

  /**
   * 設置觀察清單項目
   * @param items 觀察清單項目數組
   */
  setItems: (items: WatchlistItem[]) => void

  /**
   * 添加項目到觀察清單
   * @param item 要添加的觀察清單項目
   */
  addItem: (item: WatchlistItem) => void

  /**
   * 從觀察清單移除項目
   * @param id 項目 ID
   */
  removeItem: (id: string) => void

  /**
   * 更新觀察清單項目
   * @param id 項目 ID
   * @param updates 要更新的字段
   */
  updateItem: (id: string, updates: Partial<WatchlistItem>) => void

  /**
   * 檢查股票是否已在觀察清單中
   * @param symbol 股票代碼
   * @returns boolean
   */
  isInWatchlist: (symbol: string) => boolean

  /**
   * 設置加載狀態
   * @param isLoading 是否在加載
   */
  setIsLoading: (isLoading: boolean) => void

  /**
   * 設置錯誤信息
   * @param error 錯誤信息
   */
  setError: (error: string | null) => void

  /**
   * 清空所有觀察清單
   */
  clearAll: () => void
}

/**
 * 創建觀察清單存儲
 */
export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  // ===== 初始狀態 =====
  items: [],
  isLoading: false,
  error: null,

  // ===== 動作實現 =====

  // 設置觀察清單項目
  setItems: (items) =>
    set({ items }),

  // 添加項目
  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),

  // 移除項目
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),

  // 更新項目
  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  // 檢查是否在觀察清單中
  isInWatchlist: (symbol) => {
    const state = get()
    return state.items.some((item) => item.symbol === symbol)
  },

  // 設置加載狀態
  setIsLoading: (isLoading) =>
    set({ isLoading }),

  // 設置錯誤信息
  setError: (error) =>
    set({ error }),

  // 清空所有
  clearAll: () =>
    set({ items: [], error: null }),
}))
