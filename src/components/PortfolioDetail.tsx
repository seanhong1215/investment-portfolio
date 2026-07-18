import { useState } from 'react'
import { X, Plus, Trash2, Inbox } from 'lucide-react'
import type { Portfolio, PortfolioItem } from '@/types'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { Button, Card, Badge, EmptyState } from '@/components/ui'
import { AllocationBar } from '@/components/charts/AllocationBar'
import { calcPortfolioTotals, calcAllocation, calcTypeMix, calcGoalProgress } from '@/domain/portfolioMetrics'
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
} from '@/utils/format'
import { cn } from '@/utils/cn'

interface PortfolioDetailProps {
  portfolio: Portfolio
  onClose: () => void
}

interface FormState {
  symbol: string
  name: string
  type: 'ETF' | 'STOCK'
  investedAmount: string
  currentValue: string
  notes: string
}

const EMPTY_FORM: FormState = {
  symbol: '',
  name: '',
  type: 'STOCK',
  investedAmount: '',
  currentValue: '',
  notes: '',
}

const GOAL_LABELS: Record<Portfolio['investmentGoal'], string> = {
  RETIREMENT: '退休',
  HOME: '購屋',
  SAVINGS: '儲蓄',
  EDUCATION: '教育',
  OTHER: '其他',
}

const INPUT_CLASS =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm ' +
  'placeholder:text-ink-muted focus:border-accent focus:outline-none'

/**
 * 由持倉重算整個組合的總額。
 *
 * 原本是增量更新（totalInvested + 新持倉金額），只要有一條路徑忘了更新，
 * 誤差就永久寫進資料裡、且再也對不回來。改成一律由 items 推導後，
 * 總額不可能與持倉不一致。
 */
function withRecalculatedTotals(portfolio: Portfolio, items: PortfolioItem[]): Portfolio {
  const totals = calcPortfolioTotals(items)
  return { ...portfolio, items, ...totals, lastModified: Date.now() }
}

export function PortfolioDetail({ portfolio, onClose }: PortfolioDetailProps) {
  const savePortfolio = usePortfolioStore((s) => s.savePortfolio)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allocation = calcAllocation(portfolio.items)
  const typeMix = calcTypeMix(portfolio.items)
  const progress = calcGoalProgress(portfolio.totalValue, portfolio.targetAmount)
  const isUp = portfolio.totalGain >= 0
  // 有實際市值才顯示配置與 ETF/個股比重；全為 0 時這些百分比沒有意義
  const hasValue = portfolio.totalValue > 0

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const invested = parseFloat(form.investedAmount) || 0
    // 市值留空時視為等於投入金額（剛買進、還沒有損益）
    const current = form.currentValue === '' ? invested : parseFloat(form.currentValue) || 0

    const item: PortfolioItem = {
      id: `item_${crypto.randomUUID()}`,
      stock: {
        symbol: form.symbol.trim().toUpperCase(),
        name: form.name.trim(),
        price: current,
        change: 0,
        changePercent: 0,
        lastUpdate: Date.now(),
        type: form.type,
      },
      allocationPercentage: 0, // 實際佔比由市值推導，不需要使用者輸入
      investedAmount: invested,
      currentValue: current,
      unrealizedGain: current - invested,
      unrealizedGainPercent: invested > 0 ? ((current - invested) / invested) * 100 : 0,
      purchaseDate: Date.now(),
      notes: form.notes.trim() || undefined,
    }

    setIsSubmitting(true)
    try {
      await savePortfolio(withRecalculatedTotals(portfolio, [...portfolio.items, item]))
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增持倉失敗')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async (itemId: string) => {
    if (!window.confirm('確定要移除此持倉嗎？')) return
    setError(null)

    try {
      await savePortfolio(
        withRecalculatedTotals(
          portfolio,
          portfolio.items.filter((i) => i.id !== itemId)
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '移除持倉失敗')
    }
  }

  return (
    <Card className="mt-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{portfolio.name}</h2>
          {portfolio.description && (
            <p className="mt-1 text-sm text-ink-muted">{portfolio.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{GOAL_LABELS[portfolio.investmentGoal]}</Badge>
            {portfolio.investmentYears && <Badge>{portfolio.investmentYears} 年</Badge>}
            {hasValue && (
              <Badge>
                ETF {formatPercent(typeMix.etfPercent, 0)} / 個股 {formatPercent(typeMix.stockPercent, 0)}
              </Badge>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="關閉詳情"
          className="shrink-0 rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {portfolio.targetAmount > 0 && (
        <div className="mt-6">
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">目標進度</span>
            <span className="tabular">
              {formatCurrency(portfolio.totalValue)} / {formatCurrency(portfolio.targetAmount)}
              <span className="ml-1.5 text-ink-muted">{progress.toFixed(1)}%</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={cn('h-full rounded-full', progress >= 100 ? 'bg-good' : 'bg-accent')}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 divide-x divide-line rounded-lg border border-line">
        <div className="p-4">
          <p className="text-xs text-ink-muted">總投入</p>
          <p className="mt-1 font-semibold">{formatCurrency(portfolio.totalInvested)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-ink-muted">當前市值</p>
          <p className="mt-1 font-semibold">{formatCurrency(portfolio.totalValue)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-ink-muted">未實現損益</p>
          <p className={cn('mt-1 font-semibold tabular', isUp ? 'text-bull' : 'text-bear')}>
            {formatSignedCurrency(portfolio.totalGain)}
            <span className="ml-1 text-xs font-normal">
              {formatSignedPercent(portfolio.totalGainPercent)}
            </span>
          </p>
        </div>
      </div>

      {hasValue && (
        <div className="mt-6 border-t border-line pt-6">
          <AllocationBar slices={allocation} />
        </div>
      )}

      <div className="mt-6 border-t border-line pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">持倉明細（{portfolio.items.length}）</h3>
          <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" aria-hidden />
            新增持倉
          </Button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-critical/30 bg-critical/5 px-3 py-2 text-sm text-critical">
            {error}
          </p>
        )}

        {showForm && (
          <form onSubmit={handleAdd} className="mt-4 rounded-lg border border-line bg-surface-sunken p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs text-ink-secondary">代碼</span>
                <input
                  className={INPUT_CLASS}
                  placeholder="AAPL"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-secondary">名稱</span>
                <input
                  className={INPUT_CLASS}
                  placeholder="Apple Inc."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-secondary">類型</span>
                <select
                  className={INPUT_CLASS}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'ETF' | 'STOCK' })}
                >
                  <option value="STOCK">個股</option>
                  <option value="ETF">ETF</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-secondary">投入金額</span>
                <input
                  className={INPUT_CLASS}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="1000"
                  value={form.investedAmount}
                  onChange={(e) => setForm({ ...form, investedAmount: e.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-secondary">當前市值</span>
                <input
                  className={INPUT_CLASS}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="留空 = 同投入金額"
                  value={form.currentValue}
                  onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-secondary">備註</span>
                <input
                  className={INPUT_CLASS}
                  placeholder="選填"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                確認新增
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                取消
              </Button>
            </div>
          </form>
        )}

        {portfolio.items.length === 0 ? (
          <EmptyState
            className="mt-4"
            Icon={Inbox}
            title="尚無持倉"
            description="新增持倉後即可看到配置佔比與損益。"
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th scope="col" className="pb-2 text-left font-medium">標的</th>
                  <th scope="col" className="pb-2 text-left font-medium">類型</th>
                  <th scope="col" className="pb-2 text-right font-medium">投入</th>
                  <th scope="col" className="pb-2 text-right font-medium">市值</th>
                  <th scope="col" className="pb-2 text-right font-medium">損益</th>
                  <th scope="col" className="pb-2 text-right font-medium">佔比</th>
                  <th scope="col" className="pb-2"><span className="sr-only">操作</span></th>
                </tr>
              </thead>
              <tbody>
                {portfolio.items.map((item) => {
                  const slice = allocation.find((s) => s.symbol === item.stock.symbol)
                  const itemUp = item.unrealizedGain >= 0

                  return (
                    <tr key={item.id} className="border-b border-line last:border-0">
                      <td className="py-3">
                        <p className="font-medium">{item.stock.symbol}</p>
                        <p className="text-xs text-ink-muted">{item.stock.name}</p>
                        {item.notes && <p className="mt-0.5 text-xs text-ink-muted">{item.notes}</p>}
                      </td>
                      <td className="py-3">
                        <Badge tone={item.stock.type === 'ETF' ? 'accent' : 'neutral'}>
                          {item.stock.type}
                        </Badge>
                      </td>
                      <td className="py-3 text-right tabular">{formatCurrency(item.investedAmount)}</td>
                      <td className="py-3 text-right tabular">{formatCurrency(item.currentValue)}</td>
                      <td className={cn('py-3 text-right font-medium tabular', itemUp ? 'text-bull' : 'text-bear')}>
                        {formatSignedCurrency(item.unrealizedGain)}
                        <span className="block text-xs font-normal">
                          {formatSignedPercent(item.unrealizedGainPercent, 1)}
                        </span>
                      </td>
                      <td className="py-3 text-right tabular text-ink-secondary">
                        {slice ? formatPercent(slice.percent, 1) : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleRemove(item.id)}
                          aria-label={`移除 ${item.stock.symbol}`}
                          className="rounded p-1.5 text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}

export default PortfolioDetail
