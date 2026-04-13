/**
 * 自定義 React Hook：useWatchlist
 *
 * 管理觀察清單的 Hook
 * 包括加載、保存、添加、移除等功能
 */

import { useState, useEffect, useCallback } from 'react'
import { WatchlistItem } from '@/types'
import { storageService } from '@/services/storage'
import { useWatchlistStore } from '@/stores/watchlistStore'

/**
 * useWatchlist Hook
 *
 * 使用方式：
 * const { items, addToWatchlist, removeFromWatchlist } = useWatchlist()
 */
export function useWatchlist() {
  // ===== 狀態 =====

  // 本地組件狀態
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 全局 Zustand 存儲
  const { items, addItem, removeItem, updateItem, isInWatchlist } = useWatchlistStore()

  /**
   * 從本地存儲加載觀察清單
   * 在組件首次掛載時調用
   */
  const loadWatchlist = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 初始化存儲服務
      await storageService.init()

      // 從 IndexedDB 獲取觀察清單
      const data = await storageService.getWatchlist()

      console.log(`✅ 已加載 ${data.length} 個觀察清單項目`)

      // 更新全局狀態
      useWatchlistStore.setState({ items: data })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知錯誤'
      setError(errorMsg)
      console.error('❌ 加載觀察清單失敗:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 添加項目到觀察清單
   * @param item 要添加的觀察清單項目
   */
  const addToWatchlist = useCallback(
    async (item: Omit<WatchlistItem, 'addedDate'>) => {
      setIsLoading(true)
      setError(null)

      try {
        // 初始化存儲服務
        await storageService.init()

        // 創建完整的項目（添加時間戳）
        const newItem: WatchlistItem = {
          ...item,
          addedDate: Date.now(),
        }

        // 保存到 IndexedDB
        await storageService.saveWatchlistItem(newItem)

        // 更新全局狀態
        addItem(newItem)

        console.log(`✅ 已添加 ${item.symbol} 到觀察清單`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '未知錯誤'
        setError(errorMsg)
        console.error('❌ 添加到觀察清單失敗:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [addItem]
  )

  /**
   * 從觀察清單移除項目
   * @param id 項目 ID
   */
  const removeFromWatchlist = useCallback(
    async (id: string) => {
      setIsLoading(true)
      setError(null)

      try {
        // 初始化存儲服務
        await storageService.init()

        // 從 IndexedDB 刪除
        await storageService.deleteWatchlistItem(id)

        // 更新全局狀態
        removeItem(id)

        console.log(`✅ 已從觀察清單移除項目`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '未知錯誤'
        setError(errorMsg)
        console.error('❌ 移除觀察清單項目失敗:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [removeItem]
  )

  /**
   * 更新觀察清單項目
   * @param id 項目 ID
   * @param updates 更新的字段
   */
  const updateWatchlistItem = useCallback(
    async (id: string, updates: Partial<WatchlistItem>) => {
      setIsLoading(true)
      setError(null)

      try {
        // 初始化存儲服務
        await storageService.init()

        // 獲取現有項目
        const existingItem = items.find((item) => item.id === id)
        if (!existingItem) {
          throw new Error('項目不存在')
        }

        // 創建更新後的項目
        const updatedItem = { ...existingItem, ...updates }

        // 保存到 IndexedDB
        await storageService.saveWatchlistItem(updatedItem)

        // 更新全局狀態
        updateItem(id, updates)

        console.log(`✅ 已更新觀察清單項目`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '未知錯誤'
        setError(errorMsg)
        console.error('❌ 更新觀察清單項目失敗:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [items, updateItem]
  )

  /**
   * 在組件首次掛載時加載觀察清單
   */
  useEffect(() => {
    loadWatchlist()
  }, [loadWatchlist])

  /**
   * 返回 Hook 的公共 API
   */
  return {
    items,
    isLoading,
    error,
    loadWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    updateWatchlistItem,
    isInWatchlist,
  }
}

export default useWatchlist
