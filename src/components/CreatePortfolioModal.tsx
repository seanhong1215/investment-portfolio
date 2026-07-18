import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Portfolio, PortfolioItem, RecommendedConfiguration } from '@/types'
import { getAllRecommendedConfigurations } from '@/domain/presets'
import { Button, Badge } from '@/components/ui'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'

interface CreatePortfolioModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (portfolio: Portfolio) => void | Promise<void>
}

interface FormState {
  name: string
  description: string
  configId: string | null
  investmentGoal: Portfolio['investmentGoal']
  targetAmount: number
  investmentYears: number
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  configId: null,
  investmentGoal: 'SAVINGS',
  targetAmount: 10_000,
  investmentYears: 5,
}

const GOAL_OPTIONS: { value: Portfolio['investmentGoal']; label: string }[] = [
  { value: 'RETIREMENT', label: '退休' },
  { value: 'HOME', label: '購屋' },
  { value: 'SAVINGS', label: '儲蓄' },
  { value: 'EDUCATION', label: '教育' },
  { value: 'OTHER', label: '其他' },
]

const RISK_LABELS: Record<RecommendedConfiguration['riskLevel'], string> = {
  CONSERVATIVE: '保守',
  BALANCED: '平衡',
  AGGRESSIVE: '積極',
}

const INPUT_CLASS =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm ' +
  'placeholder:text-ink-muted focus:border-accent focus:outline-none'

/**
 * 把選定的預設配置轉成實際持倉。
 *
 * 原本這裡是個空殼：使用者被強制選一個配置，但建立出來的組合
 * items 永遠是空陣列 —— 選「平衡配置」和選「積極配置」結果完全一樣。
 *
 * 現在會依配置比例建立持倉骨架（金額為 0，等使用者填入實際買入金額），
 * 目標比例則寫進 allocationPercentage，讓再平衡偏離度有基準可比。
 */
function materializeConfig(config: RecommendedConfiguration): PortfolioItem[] {
  return config.items.map((item) => ({
    id: `item_${crypto.randomUUID()}`,
    stock: {
      symbol: item.symbol,
      name: item.symbol, // 實際名稱待報價 API 帶回
      price: 0,
      change: 0,
      changePercent: 0,
      lastUpdate: 0,
      type: item.type,
    },
    allocationPercentage: item.percentage,
    investedAmount: 0,
    currentValue: 0,
    unrealizedGain: 0,
    unrealizedGainPercent: 0,
    purchaseDate: Date.now(),
  }))
}

export function CreatePortfolioModal({ isOpen, onClose, onCreate }: CreatePortfolioModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const configs = getAllRecommendedConfigurations()

  // Esc 關閉。對話框沒有鍵盤關閉方式的話，只用鍵盤的使用者會被困在裡面。
  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // 開啟時把背景鎖住，避免捲動穿透到底下的頁面
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM)
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) return setError('請輸入投資組合名稱')
    if (form.targetAmount <= 0) return setError('目標金額必須大於 0')

    const config = form.configId ? configs.find((c) => c.id === form.configId) : undefined

    const portfolio: Portfolio = {
      id: `portfolio_${crypto.randomUUID()}`,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      items: config ? materializeConfig(config) : [],
      targetAmount: form.targetAmount,
      totalInvested: 0,
      totalValue: 0,
      totalGain: 0,
      totalGainPercent: 0,
      investmentGoal: form.investmentGoal,
      investmentYears: form.investmentYears,
      createdDate: Date.now(),
      lastModified: Date.now(),
      isDefault: false,
    }

    setIsSubmitting(true)
    try {
      await onCreate(portfolio)
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立投資組合失敗')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-portfolio-title"
        onClick={(e) => e.stopPropagation()}
        className="my-8 w-full max-w-2xl rounded-xl border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="create-portfolio-title" className="font-semibold">
            建立投資組合
          </h2>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-ink-secondary">組合名稱</span>
              <input
                className={INPUT_CLASS}
                placeholder="例如：退休核心組合"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-ink-secondary">描述（選填）</span>
              <input
                className={INPUT_CLASS}
                placeholder="這個組合的用途"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-ink-secondary">投資目標</span>
              <select
                className={INPUT_CLASS}
                value={form.investmentGoal}
                onChange={(e) =>
                  setForm({ ...form, investmentGoal: e.target.value as Portfolio['investmentGoal'] })
                }
              >
                {GOAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-ink-secondary">投資年限（年）</span>
              <input
                className={INPUT_CLASS}
                type="number"
                min="1"
                max="50"
                value={form.investmentYears}
                onChange={(e) => setForm({ ...form, investmentYears: parseInt(e.target.value) || 1 })}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-ink-secondary">
                目標金額 · {formatCurrency(form.targetAmount)}
              </span>
              <input
                className={INPUT_CLASS}
                type="number"
                min="1"
                step="1000"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: parseFloat(e.target.value) || 0 })}
                required
              />
            </label>
          </div>

          <fieldset className="mt-6">
            <legend className="text-xs text-ink-secondary">
              起始配置（選填 —— 不選則建立空組合，之後自行新增持倉）
            </legend>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {configs.map((config) => {
                const isSelected = form.configId === config.id
                return (
                  <button
                    key={config.id}
                    type="button"
                    onClick={() => setForm({ ...form, configId: isSelected ? null : config.id })}
                    aria-pressed={isSelected}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      isSelected
                        ? 'border-accent bg-accent-wash'
                        : 'border-line hover:border-line-strong'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{config.name}</span>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                      ) : (
                        <Badge>{RISK_LABELS[config.riskLevel]}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{config.description}</p>
                    <p className="mt-2 text-xs text-ink-muted">{config.items.length} 檔標的</p>
                  </button>
                )
              })}
            </div>
          </fieldset>

          {error && (
            <p className="mt-4 rounded-lg border border-critical/30 bg-critical/5 px-3 py-2 text-sm text-critical">
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              建立組合
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreatePortfolioModal
