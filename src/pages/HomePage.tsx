import { useState } from 'react'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { usePortfolioStore, selectPortfolios } from '@/stores/portfolioStore'
import { Button, Card, EmptyState, StatTile, Skeleton, Badge } from '@/components/ui'
import { AllocationBar } from '@/components/charts/AllocationBar'
import CreatePortfolioModal from '@/components/CreatePortfolioModal'
import PortfolioDetail from '@/components/PortfolioDetail'
import { summarizePortfolios, calcAllocation, calcGoalProgress } from '@/domain/portfolioMetrics'
import { formatCurrency, formatSignedCurrency, formatSignedPercent } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Portfolio } from '@/types'

const GOAL_LABELS: Record<Portfolio['investmentGoal'], string> = {
  RETIREMENT: '退休',
  HOME: '購屋',
  SAVINGS: '儲蓄',
  EDUCATION: '教育',
  OTHER: '其他',
}

interface HomePageProps {
  isLoading: boolean
}

function PortfolioCard({
  portfolio,
  isActive,
  onSelect,
  onDelete,
}: {
  portfolio: Portfolio
  isActive: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const progress = calcGoalProgress(portfolio.totalValue, portfolio.targetAmount)
  const isUp = portfolio.totalGainPercent >= 0

  return (
    <Card
      onClick={onSelect}
      className={cn(
        'cursor-pointer p-5 transition-colors',
        isActive ? 'border-accent ring-1 ring-accent' : 'hover:border-line-strong'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{portfolio.name}</h3>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge>{GOAL_LABELS[portfolio.investmentGoal]}</Badge>
            {portfolio.investmentYears && <Badge>{portfolio.investmentYears} 年</Badge>}
          </div>
        </div>
        <button
          onClick={onDelete}
          aria-label={`刪除 ${portfolio.name}`}
          className="shrink-0 rounded p-1 text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4">
        <p className="text-2xl font-semibold tracking-tight">{formatCurrency(portfolio.totalValue)}</p>
        <p className={cn('mt-0.5 text-sm font-medium tabular', isUp ? 'text-bull' : 'text-bear')}>
          {formatSignedPercent(portfolio.totalGainPercent)}
          <span className="ml-1.5 font-normal text-ink-muted">
            {formatSignedCurrency(portfolio.totalGain)}
          </span>
        </p>
      </div>

      {portfolio.targetAmount > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-ink-muted">
            <span>目標 {formatCurrency(portfolio.targetAmount)}</span>
            <span className="tabular">{progress.toFixed(0)}%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
        {portfolio.items.length} 項持倉
      </p>
    </Card>
  )
}

function HomePage({ isLoading }: HomePageProps) {
  const portfolios = usePortfolioStore(selectPortfolios)
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId)
  const setActivePortfolio = usePortfolioStore((s) => s.setActivePortfolio)
  const savePortfolio = usePortfolioStore((s) => s.savePortfolio)
  const removePortfolio = usePortfolioStore((s) => s.removePortfolio)

  const [showModal, setShowModal] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId)
  const summary = summarizePortfolios(portfolios)

  // 總覽的配置圖把所有組合的持倉攤平合併，回答「我整體押在什麼上面」。
  // 用市值 > 0 判斷是否顯示，而不是持倉數量 —— 剛用精靈建好、尚未填入
  // 實際金額的組合有 7 筆持倉但市值全為 0，這時畫配置圖只會是一張空卡。
  const allHoldings = portfolios.flatMap((p) => p.items)
  const allocation = calcAllocation(allHoldings)
  const hasAllocation = allocation.some((slice) => slice.value > 0)

  const handleCreate = async (portfolio: Portfolio) => {
    setSaveError(null)
    try {
      await savePortfolio(portfolio)
      setActivePortfolio(portfolio.id)
      setShowModal(false)
    } catch (err) {
      // store 的動作會如實往上拋，這裡才有東西可以接
      setSaveError(err instanceof Error ? err.message : '建立投資組合失敗')
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('確定要刪除此投資組合嗎？此操作無法復原。')) return

    try {
      await removePortfolio(id)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '刪除失敗')
    }
  }

  return (
    <div>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-lg font-semibold">投資組合</h1>
            <p className="mt-0.5 text-sm text-ink-muted">管理與追蹤所有投資組合</p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            新建組合
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {saveError && (
          <div className="mb-6 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical">
            {saveError}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : portfolios.length === 0 ? (
          <EmptyState
            Icon={Wallet}
            title="還沒有投資組合"
            description="建立第一個投資組合，或到「建立組合」回答幾個問題，讓系統依你的目標推薦配置。"
            action={
              <Button onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                建立投資組合
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-3">
              <StatTile label="總投入" value={formatCurrency(summary.totalInvested)} />
              <StatTile
                label="總市值"
                value={formatCurrency(summary.totalValue)}
                emphasis="hero"
                deltaPercent={summary.totalGainPercent}
                deltaLabel={formatSignedCurrency(summary.totalGain)}
              />
              <StatTile label="持有組合" value={`${portfolios.length}`} />
            </div>

            {hasAllocation && (
              <Card className="mt-6 p-5">
                <AllocationBar slices={allocation} />
              </Card>
            )}

            <section className="mt-8">
              <h2 className="mb-4 text-sm font-semibold text-ink-secondary">
                所有組合（{portfolios.length}）
              </h2>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {portfolios.map((portfolio) => (
                  <PortfolioCard
                    key={portfolio.id}
                    portfolio={portfolio}
                    isActive={portfolio.id === activePortfolioId}
                    onSelect={() =>
                      setActivePortfolio(activePortfolioId === portfolio.id ? null : portfolio.id)
                    }
                    onDelete={(e) => handleDelete(e, portfolio.id)}
                  />
                ))}
              </div>
            </section>

            {activePortfolio && (
              <PortfolioDetail
                portfolio={activePortfolio}
                onClose={() => setActivePortfolio(null)}
              />
            )}
          </>
        )}
      </main>

      <CreatePortfolioModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}

export default HomePage
