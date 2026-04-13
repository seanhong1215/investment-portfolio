/**
 * 自定義 React Hook：usePortfolio
 *
 * 管理投資組合相關的邏輯
 * 包括加載、保存、計算等功能
 *
 * Hook 是 React 中重用代碼邏輯的方式
 * 比類組件更簡潔和易懂
 */

import { useState, useEffect, useCallback } from 'react'
import { Portfolio } from '@/types'
import { storageService } from '@/services/storage'
import { usePortfolioStore } from '@/stores/portfolioStore'

/**
 * usePortfolio Hook
 *
 * 使用方式：
 * const { portfolios, loading, error, loadPortfolios, savePortfolio } = usePortfolio()
 */
export function usePortfolio() {
  // ===== 狀態 =====

  // 本地組件狀態
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 全局 Zustand 存儲
  const { portfolios, addPortfolio, updatePortfolio, deletePortfolio } = usePortfolioStore()

  /**
   * 從本地存儲加載所有投資組合
   * 在組件首次掛載時調用
   */
  const loadPortfolios = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 初始化存儲服務（連接到 IndexedDB）
      await storageService.init()

      // 從 IndexedDB 獲取所有投資組合
      const data = await storageService.getAllPortfolios()

      console.log(`✅ 已加載 ${data.length} 個投資組合`)

      // 更新全局狀態
      usePortfolioStore.setState({ portfolios: data })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知錯誤'
      setError(errorMsg)
      console.error('❌ 加載投資組合失敗:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 保存新投資組合或更新現有投資組合
   * @param portfolio 要保存的投資組合
   */
  const savePortfolio = useCallback(
    async (portfolio: Portfolio) => {
      setIsLoading(true)
      setError(null)

      try {
        // 初始化存儲服務
        await storageService.init()

        // 保存到 IndexedDB
        await storageService.savePortfolio(portfolio)

        // 如果是新建，添加到存儲；如果是更新，更新存儲
        const existingPortfolio = portfolios.find((p) => p.id === portfolio.id)

        if (existingPortfolio) {
          // 更新現有投資組合
          updatePortfolio(portfolio.id, portfolio)
        } else {
          // 添加新投資組合
          addPortfolio(portfolio)
        }

        console.log(`✅ 投資組合 "${portfolio.name}" 已保存`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '未知錯誤'
        setError(errorMsg)
        console.error('❌ 保存投資組合失敗:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [portfolios, addPortfolio, updatePortfolio]
  )

  /**
   * 刪除投資組合
   * @param id 投資組合 ID
   */
  const removePortfolio = useCallback(
    async (id: string) => {
      setIsLoading(true)
      setError(null)

      try {
        // 初始化存儲服務
        await storageService.init()

        // 從 IndexedDB 刪除
        await storageService.deletePortfolio(id)

        // 更新全局狀態
        deletePortfolio(id)

        console.log(`✅ 投資組合已刪除`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '未知錯誤'
        setError(errorMsg)
        console.error('❌ 刪除投資組合失敗:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [deletePortfolio]
  )

  /**
   * 在組件首次掛載時加載投資組合
   */
  useEffect(() => {
    loadPortfolios()
  }, [loadPortfolios])

  /**
   * 返回 Hook 的公共 API
   */
  return {
    portfolios,
    isLoading,
    error,
    loadPortfolios,
    savePortfolio,
    removePortfolio,
  }
}

export default usePortfolio
