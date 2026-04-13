import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { Portfolio, PortfolioItem } from '@/types'
import { cardClass, getButtonClass } from '@/utils/classNames'
import { usePortfolio } from '@/hooks/usePortfolio'

interface PortfolioDetailProps {
  portfolio: Portfolio
  onClose: () => void
}

interface AddStockFormData {
  symbol: string
  name: string
  type: 'ETF' | 'STOCK'
  investedAmount: string
  currentValue: string
  allocationPercentage: string
  notes: string
}

const defaultFormData: AddStockFormData = {
  symbol: '',
  name: '',
  type: 'STOCK',
  investedAmount: '',
  currentValue: '',
  allocationPercentage: '',
  notes: '',
}

const GOAL_LABELS: Record<Portfolio['investmentGoal'], string> = {
  RETIREMENT: '🏖️ 退休',
  HOME: '🏠 買房',
  SAVINGS: '💰 儲蓄',
  EDUCATION: '🎓 教育',
  OTHER: '📌 其他',
}

export function PortfolioDetail({ portfolio, onClose }: PortfolioDetailProps) {
  const { savePortfolio } = usePortfolio()
  const [showAddForm, setShowAddForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<AddStockFormData>(defaultFormData)

  const progressPercent = portfolio.targetAmount > 0
    ? Math.min((portfolio.totalValue / portfolio.targetAmount) * 100, 100)
    : 0

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.symbol.trim() || !formData.name.trim() || !formData.investedAmount) return

    setIsSubmitting(true)
    try {
      const invested = parseFloat(formData.investedAmount) || 0
      const current = parseFloat(formData.currentValue) || invested
      const allocation = parseFloat(formData.allocationPercentage) || 0

      const newItem: PortfolioItem = {
        id: `item_${Date.now()}`,
        stock: {
          symbol: formData.symbol.toUpperCase(),
          name: formData.name,
          price: current,
          changePercent: 0,
          change: 0,
          lastUpdate: Date.now(),
          type: formData.type,
        },
        allocationPercentage: allocation,
        investedAmount: invested,
        currentValue: current,
        unrealizedGain: current - invested,
        unrealizedGainPercent: invested > 0 ? ((current - invested) / invested) * 100 : 0,
        purchaseDate: Date.now(),
        notes: formData.notes || undefined,
      }

      const newTotalInvested = portfolio.totalInvested + invested
      const newTotalValue = portfolio.totalValue + current
      const updatedPortfolio: Portfolio = {
        ...portfolio,
        items: [...portfolio.items, newItem],
        totalInvested: newTotalInvested,
        totalValue: newTotalValue,
        totalGain: newTotalValue - newTotalInvested,
        totalGainPercent: newTotalInvested > 0 ? ((newTotalValue - newTotalInvested) / newTotalInvested) * 100 : 0,
        lastModified: Date.now(),
      }

      await savePortfolio(updatedPortfolio)
      setFormData(defaultFormData)
      setShowAddForm(false)
    } catch (err) {
      console.error('新增持倉失敗:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!window.confirm('確定要移除此持倉嗎？')) return

    const item = portfolio.items.find((i) => i.id === itemId)
    if (!item) return

    const newTotalInvested = portfolio.totalInvested - item.investedAmount
    const newTotalValue = portfolio.totalValue - item.currentValue
    const updatedPortfolio: Portfolio = {
      ...portfolio,
      items: portfolio.items.filter((i) => i.id !== itemId),
      totalInvested: newTotalInvested,
      totalValue: newTotalValue,
      totalGain: newTotalValue - newTotalInvested,
      totalGainPercent: newTotalInvested > 0 ? ((newTotalValue - newTotalInvested) / newTotalInvested) * 100 : 0,
      lastModified: Date.now(),
    }

    await savePortfolio(updatedPortfolio)
  }

  return (
    <div className={`${cardClass} mt-8`}>
      {/* 頭部 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{portfolio.name}</h2>
          {portfolio.description && (
            <p className="text-slate-600 text-sm mt-1">{portfolio.description}</p>
          )}
          <div className="flex gap-4 mt-2 text-sm text-slate-500">
            <span>目標：{GOAL_LABELS[portfolio.investmentGoal]}</span>
            {portfolio.investmentYears && (
              <span>投資年限：{portfolio.investmentYears} 年</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* 目標進度 */}
      {portfolio.targetAmount > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-600">目標進度</span>
            <span className="font-semibold text-slate-900">
              ${portfolio.totalValue.toLocaleString()} / ${portfolio.targetAmount.toLocaleString()}
              <span className="text-slate-500 ml-1">({progressPercent.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                progressPercent >= 100
                  ? 'bg-green-500'
                  : progressPercent >= 50
                    ? 'bg-blue-500'
                    : 'bg-blue-400'
              }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 統計數字 */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-1">總投入</p>
          <p className="font-bold text-slate-900">
            ${portfolio.totalInvested.toLocaleString()}
          </p>
        </div>
        <div className="text-center border-x border-slate-200">
          <p className="text-xs text-slate-500 mb-1">當前市值</p>
          <p className="font-bold text-slate-900">
            ${portfolio.totalValue.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-1">未實現損益</p>
          <p className={`font-bold ${portfolio.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {portfolio.totalGain >= 0 ? '+' : ''}${portfolio.totalGain.toLocaleString()}
            <span className="text-xs ml-1">
              ({portfolio.totalGainPercent >= 0 ? '+' : ''}{portfolio.totalGainPercent.toFixed(2)}%)
            </span>
          </p>
        </div>
      </div>

      {/* 持倉列表 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            持倉明細 ({portfolio.items.length})
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`${getButtonClass('primary')} flex items-center gap-1.5 text-sm`}
          >
            <Plus className="w-4 h-4" />
            新增持倉
          </button>
        </div>

        {/* 新增持倉表單 */}
        {showAddForm && (
          <form
            onSubmit={handleAddStock}
            className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <h4 className="font-semibold text-slate-900 mb-3">新增持倉</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                placeholder="股票代碼 (AAPL)"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="公司名稱"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as 'ETF' | 'STOCK' })
                }
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="STOCK">個股</option>
                <option value="ETF">ETF</option>
              </select>
              <input
                type="number"
                placeholder="投入金額 ($)"
                value={formData.investedAmount}
                onChange={(e) => setFormData({ ...formData, investedAmount: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
                required
              />
              <input
                type="number"
                placeholder="當前市值 ($，留空同投入)"
                value={formData.currentValue}
                onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
              <input
                type="number"
                placeholder="配置比例 (%)"
                value={formData.allocationPercentage}
                onChange={(e) =>
                  setFormData({ ...formData, allocationPercentage: e.target.value })
                }
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <input
              type="text"
              placeholder="備註（可選）"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${getButtonClass('success')} text-sm`}
              >
                {isSubmitting ? '新增中...' : '確認新增'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className={`${getButtonClass('secondary')} text-sm`}
              >
                取消
              </button>
            </div>
          </form>
        )}

        {/* 持倉表格 */}
        {portfolio.items.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <div className="text-4xl mb-2">📭</div>
            <p className="font-medium">尚無持倉記錄</p>
            <p className="text-sm mt-1">點擊「新增持倉」開始追蹤您的投資</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">股票</th>
                  <th className="text-center px-4 py-3 text-slate-600 font-medium">類型</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">投入</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">市值</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">損益</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">配置</th>
                  <th className="text-center px-4 py-3 text-slate-600 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.stock.symbol}</p>
                      <p className="text-xs text-slate-500">{item.stock.name}</p>
                      {item.notes && (
                        <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          item.stock.type === 'ETF'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {item.stock.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      ${item.investedAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      ${item.currentValue.toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        item.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {item.unrealizedGain >= 0 ? '+' : ''}${item.unrealizedGain.toLocaleString()}
                      <span className="text-xs block">
                        ({item.unrealizedGainPercent >= 0 ? '+' : ''}
                        {item.unrealizedGainPercent.toFixed(1)}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {item.allocationPercentage > 0
                        ? `${item.allocationPercentage}%`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-lg transition"
                        title="移除持倉"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default PortfolioDetail
