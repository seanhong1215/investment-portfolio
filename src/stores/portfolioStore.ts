/**
 * 投資組合狀態存儲
 *
 * 使用 Zustand 管理應用全局狀態
 * Zustand 是一個輕量級的狀態管理庫，比 Redux 簡單得多
 *
 * 狀態存儲包括：
 * - 投資組合列表
 * - 當前活躍投資組合
 * - 加載狀態
 * - 錯誤信息
 */

import { create } from 'zustand'
import { Portfolio, PortfolioItem } from '@/types'

/**
 * 定義存儲的狀態類型
 */
interface PortfolioStore {
  // ===== 狀態 =====
  // 所有投資組合列表
  portfolios: Portfolio[]
  // 當前活躍投資組合 ID
  activePortfolioId: string | null
  // 是否在加載中
  isLoading: boolean
  // 錯誤信息（如果有的話）
  error: string | null

  // ===== 動作（修改狀態的方法） =====

  /**
   * 設置投資組合列表
   * @param portfolios 新的投資組合列表
   */
  setPortfolios: (portfolios: Portfolio[]) => void

  /**
   * 添加新投資組合
   * @param portfolio 要添加的投資組合
   */
  addPortfolio: (portfolio: Portfolio) => void

  /**
   * 更新投資組合
   * @param id 投資組合 ID
   * @param portfolio 更新的投資組合數據
   */
  updatePortfolio: (id: string, portfolio: Partial<Portfolio>) => void

  /**
   * 刪除投資組合
   * @param id 投資組合 ID
   */
  deletePortfolio: (id: string) => void

  /**
   * 設置當前活躍投資組合
   * @param id 投資組合 ID
   */
  setActivePortfolio: (id: string | null) => void

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
   * 向投資組合添加項目
   * @param portfolioId 投資組合 ID
   * @param item 要添加的項目
   */
  addPortfolioItem: (portfolioId: string, item: PortfolioItem) => void

  /**
   * 從投資組合移除項目
   * @param portfolioId 投資組合 ID
   * @param itemId 項目 ID
   */
  removePortfolioItem: (portfolioId: string, itemId: string) => void

  /**
   * 獲取當前活躍投資組合
   * @returns 當前活躍投資組合或 undefined
   */
  getActivePortfolio: () => Portfolio | undefined
}

/**
 * 創建存儲
 * 使用 Zustand 的 create 函數來定義狀態和動作
 */
export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  // ===== 初始狀態 =====
  portfolios: [],
  activePortfolioId: null,
  isLoading: false,
  error: null,

  // ===== 動作實現 =====

  // 設置投資組合列表
  setPortfolios: (portfolios) =>
    set({ portfolios }),

  // 添加新投資組合
  addPortfolio: (portfolio) =>
    set((state) => ({
      portfolios: [...state.portfolios, portfolio],
    })),

  // 更新投資組合
  updatePortfolio: (id, updates) =>
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === id ? { ...p, ...updates, lastModified: Date.now() } : p
      ),
    })),

  // 刪除投資組合
  deletePortfolio: (id) =>
    set((state) => ({
      portfolios: state.portfolios.filter((p) => p.id !== id),
      activePortfolioId: state.activePortfolioId === id ? null : state.activePortfolioId,
    })),

  // 設置當前活躍投資組合
  setActivePortfolio: (id) =>
    set({ activePortfolioId: id }),

  // 設置加載狀態
  setIsLoading: (isLoading) =>
    set({ isLoading }),

  // 設置錯誤信息
  setError: (error) =>
    set({ error }),

  // 添加投資組合項目
  addPortfolioItem: (portfolioId, item) =>
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              items: [...p.items, item],
              lastModified: Date.now(),
            }
          : p
      ),
    })),

  // 移除投資組合項目
  removePortfolioItem: (portfolioId, itemId) =>
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              items: p.items.filter((item) => item.id !== itemId),
              lastModified: Date.now(),
            }
          : p
      ),
    })),

  // 獲取當前活躍投資組合
  getActivePortfolio: () => {
    const state = get()
    // 如果有活躍 ID，返回對應的投資組合
    if (state.activePortfolioId) {
      return state.portfolios.find((p) => p.id === state.activePortfolioId)
    }
    // 否則返回 undefined
    return undefined
  },
}))
