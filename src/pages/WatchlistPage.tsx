/**
 * 觀察清單頁面
 *
 * 顯示用戶的觀察清單
 * 允許用戶查看、添加、移除和編輯觀察清單項目
 */

import { useState } from 'react'
import { Plus, Edit2, Trash2, Heart } from 'lucide-react'
import { cardClass, getButtonClass, SPINNER_CLASS } from '@/utils/classNames'
import { useWatchlist } from '@/hooks/useWatchlist'
import { WatchlistItem } from '@/types'

/**
 * WatchlistPage 組件
 */
export function WatchlistPage() {
  // ===== 狀態 =====

  // 從 Hook 獲取觀察清單數據和操作
  const { items, isLoading, error, removeFromWatchlist, updateWatchlistItem, addToWatchlist } =
    useWatchlist()

  // 顯示添加表單
  const [showAddForm, setShowAddForm] = useState(false)

  // 正在編輯的項目 ID
  const [editingId, setEditingId] = useState<string | null>(null)

  // 添加表單數據
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    type: 'STOCK' as 'ETF' | 'STOCK',
    targetPrice: '',
    notes: '',
  })

  // ===== 事件處理器 =====

  /**
   * 處理添加項目
   */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.symbol.trim() || !formData.name.trim()) {
      return
    }

    try {
      const newItem: Omit<WatchlistItem, 'addedDate'> = {
        id: `watchlist_${Date.now()}`,
        symbol: formData.symbol.toUpperCase(),
        name: formData.name,
        type: formData.type,
        targetPrice: formData.targetPrice ? parseFloat(formData.targetPrice) : undefined,
        notes: formData.notes || undefined,
      }

      await addToWatchlist(newItem)

      // 重置表單
      setFormData({
        symbol: '',
        name: '',
        type: 'STOCK',
        targetPrice: '',
        notes: '',
      })
      setShowAddForm(false)
    } catch (err) {
      console.error('❌ 添加到觀察清單失敗:', err)
    }
  }

  /**
   * 處理移除項目
   */
  const handleRemove = async (id: string) => {
    if (window.confirm('確定要移除此項目嗎？')) {
      await removeFromWatchlist(id)
    }
  }

  /**
   * 處理編輯項目
   */
  const handleEdit = async (item: WatchlistItem) => {
    if (!formData.notes && editingId === item.id) {
      setEditingId(null)
    } else {
      setEditingId(item.id)
      setFormData({
        symbol: item.symbol,
        name: item.name,
        type: item.type,
        targetPrice: item.targetPrice?.toString() || '',
        notes: item.notes || '',
      })
    }
  }

  /**
   * 保存編輯
   */
  const handleSaveEdit = async () => {
    if (!editingId) return

    try {
      await updateWatchlistItem(editingId, {
        targetPrice: formData.targetPrice ? parseFloat(formData.targetPrice) : undefined,
        notes: formData.notes || undefined,
      })
      setEditingId(null)
      setFormData({
        symbol: '',
        name: '',
        type: 'STOCK',
        targetPrice: '',
        notes: '',
      })
    } catch (err) {
      console.error('❌ 更新觀察清單項目失敗:', err)
    }
  }

  // ===== 渲染 =====

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-slate-100">
      {/* 頁面頭部 */}
      <header className="bg-white shadow-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-600" />
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  ❤️ 觀察清單
                </h1>
                <p className="text-slate-600 mt-1">
                  跟踪您感興趣的股票和 ETF
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`${getButtonClass('primary')} inline-flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              添加股票
            </button>
          </div>
        </div>
      </header>

      {/* 主內容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 添加表單 */}
        {showAddForm && (
          <form onSubmit={handleAdd} className={`${cardClass} mb-8`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="股票代碼 (例如: AAPL)"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <input
                type="text"
                placeholder="公司名稱"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'ETF' | 'STOCK' })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="STOCK">個股</option>
                <option value="ETF">ETF</option>
              </select>
              <input
                type="number"
                placeholder="目標價格"
                value={formData.targetPrice}
                onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                step="0.01"
              />
            </div>
            <textarea
              placeholder="備註"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!formData.symbol.trim() || !formData.name.trim()}
                className={getButtonClass('success')}
              >
                添加
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className={getButtonClass('secondary')}
              >
                取消
              </button>
            </div>
          </form>
        )}

        {/* 加載中 */}
        {isLoading && items.length === 0 && (
          <div className="flex justify-center py-12">
            <div className={SPINNER_CLASS} />
          </div>
        )}

        {/* 錯誤 */}
        {error && (
          <div className={`${cardClass} text-red-600`}>
            ⚠️ {error}
          </div>
        )}

        {/* 空狀態 */}
        {!isLoading && items.length === 0 && !error && (
          <div className={`${cardClass} text-center py-12`}>
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              還沒有觀察清單
            </h3>
            <p className="text-slate-600 mb-6">
              添加您感興趣的股票或 ETF，跟踪它們的價格變化
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className={`${getButtonClass('primary')} inline-flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              添加第一個股票
            </button>
          </div>
        )}

        {/* 觀察清單項目 */}
        {items.length > 0 && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div key={item.id} className={`${cardClass} relative`}>
                {/* 頭部 */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {item.symbol}
                    </h3>
                    <p className="text-sm text-slate-600">{item.name}</p>
                  </div>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    {item.type}
                  </span>
                </div>

                {/* 信息 */}
                <div className="space-y-2 mb-4">
                  {item.targetPrice && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">目標價格：</span>
                      <span className="font-semibold text-slate-900">
                        ${item.targetPrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {item.currentPrice && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">當前價格：</span>
                      <span className="font-semibold text-slate-900">
                        ${item.currentPrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-sm">
                      <span className="text-slate-600">備註：</span>
                      <p className="text-slate-700 mt-1 text-xs">{item.notes}</p>
                    </div>
                  )}
                </div>

                {/* 添加日期 */}
                <div className="text-xs text-slate-500 mb-4">
                  添加於：{new Date(item.addedDate).toLocaleDateString('zh-TW')}
                </div>

                {/* 操作按鈕 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    移除
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                    編輯
                  </button>
                </div>

                {/* 編輯模式 */}
                {editingId === item.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                    <input
                      type="number"
                      placeholder="目標價格"
                      value={formData.targetPrice}
                      onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      step="0.01"
                    />
                    <textarea
                      placeholder="備註"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 px-2 py-1 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded transition"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 px-2 py-1 text-sm bg-slate-200 text-slate-600 hover:bg-slate-300 rounded transition"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default WatchlistPage
