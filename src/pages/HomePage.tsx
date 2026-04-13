import { useState } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePortfolio } from '@/hooks/usePortfolio'
import { Plus, Trash2 } from 'lucide-react'
import { cardClass, getButtonClass, SPINNER_CLASS } from '@/utils/classNames'
import CreatePortfolioModal from '@/components/CreatePortfolioModal'
import PortfolioDetail from '@/components/PortfolioDetail'
import { Portfolio } from '@/types'

const GOAL_LABELS: Record<Portfolio['investmentGoal'], string> = {
  RETIREMENT: '🏖️ 退休',
  HOME: '🏠 買房',
  SAVINGS: '💰 儲蓄',
  EDUCATION: '🎓 教育',
  OTHER: '📌 其他',
}

function HomePage() {
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const setActivePortfolio = usePortfolioStore((state) => state.setActivePortfolio)

  const { savePortfolio, removePortfolio, isLoading } = usePortfolio()

  const [showNewPortfolioModal, setShowNewPortfolioModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId)

  // ===== 事件處理 =====

  const handleCreatePortfolio = async (portfolio: Portfolio) => {
    setIsCreating(true)
    try {
      await savePortfolio(portfolio)
      setActivePortfolio(portfolio.id)
    } catch (err) {
      console.error('建立投資組合失敗:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeletePortfolio = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('確定要刪除此投資組合嗎？此操作無法復原。')) return
    if (activePortfolioId === id) setActivePortfolio(null)
    await removePortfolio(id)
  }

  const handleSelectPortfolio = (id: string) => {
    setActivePortfolio(activePortfolioId === id ? null : id)
  }

  // ===== 統計計算 =====

  const totalInvested = portfolios.reduce((sum, p) => sum + p.totalInvested, 0)
  const totalValue = portfolios.reduce((sum, p) => sum + p.totalValue, 0)
  const totalGain = totalValue - totalInvested
  const totalGainPercent = totalInvested === 0 ? 0 : (totalGain / totalInvested) * 100

  // ===== 渲染 =====

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* 頁面頭部 */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">我的投資組合</h2>
              <p className="text-slate-500 text-sm mt-0.5">
                管理與追蹤您的所有投資組合
              </p>
            </div>
            <button
              onClick={() => setShowNewPortfolioModal(true)}
              className={`${getButtonClass('primary')} flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              新建組合
            </button>
          </div>
        </div>
      </header>

      {/* 主內容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 載入中 */}
        {isLoading && portfolios.length === 0 && (
          <div className="flex justify-center py-16">
            <div className={SPINNER_CLASS} />
          </div>
        )}

        {/* 統計卡片 */}
        {portfolios.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">總投入金額</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    ${totalInvested.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-xl text-2xl">💰</div>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">當前市值</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-xl text-2xl">📊</div>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">總收益</p>
                  <p
                    className={`text-3xl font-bold mt-1 ${
                      totalGain >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {totalGain >= 0 ? '+' : ''}$
                    {Math.abs(totalGain).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                  <p
                    className={`text-sm mt-0.5 ${
                      totalGainPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {totalGainPercent >= 0 ? '+' : ''}
                    {totalGainPercent.toFixed(2)}%
                  </p>
                </div>
                <div
                  className={`p-3 rounded-xl text-2xl ${
                    totalGain >= 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  {totalGain >= 0 ? '📈' : '📉'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 投資組合列表 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-5">
            我的投資組合
            {portfolios.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                共 {portfolios.length} 個
              </span>
            )}
          </h2>

          {portfolios.length === 0 ? (
            // 空狀態
            <div className={`${cardClass} text-center py-14`}>
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                還沒有投資組合
              </h3>
              <p className="text-slate-500 mb-6">
                建立第一個投資組合，開始您的投資之旅！
              </p>
              <button
                onClick={() => setShowNewPortfolioModal(true)}
                className={`${getButtonClass('primary')} inline-flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" />
                建立投資組合
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {portfolios.map((portfolio) => {
                const isActive = activePortfolioId === portfolio.id
                const progressPercent =
                  portfolio.targetAmount > 0
                    ? Math.min(
                        (portfolio.totalValue / portfolio.targetAmount) * 100,
                        100
                      )
                    : 0

                return (
                  <div
                    key={portfolio.id}
                    onClick={() => handleSelectPortfolio(portfolio.id)}
                    className={`bg-white rounded-lg shadow-md p-6 border cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                      isActive
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* 標題列 */}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight pr-2">
                        {portfolio.name}
                      </h3>
                      <button
                        onClick={(e) => handleDeletePortfolio(e, portfolio.id)}
                        className="p-1 hover:bg-red-50 hover:text-red-600 text-slate-300 rounded transition shrink-0"
                        title="刪除組合"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {portfolio.description && (
                      <p className="text-slate-500 text-sm mb-3 line-clamp-2">
                        {portfolio.description}
                      </p>
                    )}

                    {/* 目標標籤 */}
                    <div className="mb-4">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                        {GOAL_LABELS[portfolio.investmentGoal]}
                        {portfolio.investmentYears && ` · ${portfolio.investmentYears}年`}
                      </span>
                    </div>

                    {/* 目標進度條 */}
                    {portfolio.targetAmount > 0 && (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>目標進度</span>
                          <span>{progressPercent.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 財務摘要 */}
                    <div className="space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">投入</span>
                        <span className="font-medium text-slate-900">
                          ${portfolio.totalInvested.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">市值</span>
                        <span className="font-medium text-slate-900">
                          ${portfolio.totalValue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">損益</span>
                        <span
                          className={`font-semibold ${
                            portfolio.totalGainPercent >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {portfolio.totalGainPercent >= 0 ? '+' : ''}
                          {portfolio.totalGainPercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* 持倉數量 */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        {portfolio.items.length} 項持倉
                      </p>
                      {isActive && (
                        <span className="text-xs text-blue-600 font-medium">
                          已選取 ▾
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 投資組合詳情 */}
        {activePortfolio && (
          <PortfolioDetail
            portfolio={activePortfolio}
            onClose={() => setActivePortfolio(null)}
          />
        )}

        {/* 投資建議 */}
        <section className="mt-12 bg-white rounded-xl shadow p-8 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-5">💡 投資建議</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-bold text-slate-900 mb-1">1️⃣ 建立平衡投資組合</h3>
              <p className="text-slate-600 text-sm">
                推薦使用 70% ETF + 30% 個股的配置，降低風險同時保持增長
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-bold text-slate-900 mb-1">2️⃣ 定期定額投資</h3>
              <p className="text-slate-600 text-sm">
                每月定額投資，不受市場短期波動影響，長期穩健增長
              </p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-bold text-slate-900 mb-1">3️⃣ 設置投資目標</h3>
              <p className="text-slate-600 text-sm">
                在「投資目標」頁面設定退休、買房等目標，追蹤達成進度
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 建立投資組合 Modal */}
      <CreatePortfolioModal
        isOpen={showNewPortfolioModal}
        onClose={() => setShowNewPortfolioModal(false)}
        onCreate={handleCreatePortfolio}
      />

      {/* 建立中遮罩 */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            <span className="text-slate-900 font-medium">建立中...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
