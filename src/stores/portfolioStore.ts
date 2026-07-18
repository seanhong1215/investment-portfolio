/**
 * 投資組合全域狀態。
 *
 * 非同步動作直接放在 store 裡，而不是包成 usePortfolio hook。
 * 原本的寫法有兩個實際的 bug：
 *
 * 1. 重複載入：App 與 HomePage 各呼叫一次 usePortfolio()，兩份 useEffect
 *    各跑一次 loadPortfolios()，開場就打兩次資料庫，且兩份 isLoading
 *    互不相干 —— 一份轉完了另一份還在轉。
 * 2. 錯誤被吞掉：savePortfolio 內部 catch 後只 setError 不重拋，
 *    呼叫端的 try/catch 永遠不會進 catch，存檔失敗畫面照樣往下走。
 *
 * 收進 store 後狀態只有一份，動作失敗會如實往上拋。
 */

import { create } from 'zustand'
import type { Portfolio, PortfolioItem } from '@/types'
import { storageService } from '@/services/storage'

interface PortfolioStore {
  portfolios: Portfolio[]
  activePortfolioId: string | null
  /** 首次載入中。只在 loadPortfolios 期間為 true */
  isLoading: boolean
  /** 載入失敗的原因。單筆操作的錯誤由呼叫端自行處理 */
  error: string | null

  loadPortfolios: () => Promise<void>
  savePortfolio: (portfolio: Portfolio) => Promise<void>
  removePortfolio: (id: string) => Promise<void>
  setActivePortfolio: (id: string | null) => void
  addPortfolioItem: (portfolioId: string, item: PortfolioItem) => void
  removePortfolioItem: (portfolioId: string, itemId: string) => void
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  portfolios: [],
  activePortfolioId: null,
  isLoading: true,
  error: null,

  loadPortfolios: async () => {
    set({ isLoading: true, error: null })
    try {
      await storageService.init()
      set({ portfolios: await storageService.getAll(), isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '載入投資組合失敗',
        isLoading: false,
      })
    }
  },

  // 先寫入儲存層，成功後才更新畫面 —— 顛倒過來的話，寫入失敗時
  // 畫面會顯示一個實際上沒被存下來的組合，重整後就消失了。
  savePortfolio: async (portfolio) => {
    await storageService.save(portfolio)

    set((state) => {
      const exists = state.portfolios.some((p) => p.id === portfolio.id)
      return {
        portfolios: exists
          ? state.portfolios.map((p) =>
              p.id === portfolio.id ? { ...portfolio, lastModified: Date.now() } : p
            )
          : [...state.portfolios, portfolio],
      }
    })
  },

  removePortfolio: async (id) => {
    await storageService.remove(id)

    set((state) => ({
      portfolios: state.portfolios.filter((p) => p.id !== id),
      activePortfolioId: state.activePortfolioId === id ? null : state.activePortfolioId,
    }))
  },

  setActivePortfolio: (id) => set({ activePortfolioId: id }),

  addPortfolioItem: (portfolioId, item) => {
    const portfolio = get().portfolios.find((p) => p.id === portfolioId)
    if (!portfolio) return

    void get().savePortfolio({ ...portfolio, items: [...portfolio.items, item] })
  },

  removePortfolioItem: (portfolioId, itemId) => {
    const portfolio = get().portfolios.find((p) => p.id === portfolioId)
    if (!portfolio) return

    void get().savePortfolio({
      ...portfolio,
      items: portfolio.items.filter((item) => item.id !== itemId),
    })
  },
}))

/**
 * 細粒度 selector。
 * 元件請用這些而不是 usePortfolioStore() 整包解構 —— 整包解構會讓
 * store 任一欄位變動都觸發重繪，包括那些該元件根本不在意的欄位。
 */
export const selectPortfolios = (s: PortfolioStore) => s.portfolios
export const selectActivePortfolio = (s: PortfolioStore) =>
  s.portfolios.find((p) => p.id === s.activePortfolioId)
