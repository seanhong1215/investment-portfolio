import { useState } from 'react'
import { Plus, X, Edit2, Trash2, CheckCircle, Circle, Target } from 'lucide-react'
import { cardClass, getButtonClass, SPINNER_CLASS } from '@/utils/classNames'
import { useGoals } from '@/hooks/useGoals'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { InvestmentGoal } from '@/types'

// ===== 設定常數 =====

const GOAL_TYPE_CONFIG: Record<
  InvestmentGoal['goalType'],
  { label: string; emoji: string }
> = {
  RETIREMENT: { label: '退休', emoji: '🏖️' },
  HOME: { label: '買房', emoji: '🏠' },
  SAVINGS: { label: '儲蓄', emoji: '💰' },
  EDUCATION: { label: '教育', emoji: '🎓' },
  EMERGENCY: { label: '緊急備用金', emoji: '🚨' },
  OTHER: { label: '其他', emoji: '📌' },
}

const PRIORITY_CONFIG: Record<
  InvestmentGoal['priority'],
  { label: string; className: string }
> = {
  HIGH: { label: '高', className: 'bg-red-100 text-red-700' },
  MEDIUM: { label: '中', className: 'bg-yellow-100 text-yellow-700' },
  LOW: { label: '低', className: 'bg-blue-100 text-blue-700' },
}

// ===== 表單類型 =====

interface GoalFormData {
  name: string
  goalType: InvestmentGoal['goalType']
  priority: InvestmentGoal['priority']
  targetAmount: string
  currentAmount: string
  linkedPortfolioId: string
  deadline: string
  monthlyContribution: string
  description: string
}

const defaultFormData: GoalFormData = {
  name: '',
  goalType: 'SAVINGS',
  priority: 'MEDIUM',
  targetAmount: '',
  currentAmount: '0',
  linkedPortfolioId: '',
  deadline: '',
  monthlyContribution: '',
  description: '',
}

// ===== 工具函數 =====

function getProgressBarColor(progress: number): string {
  if (progress >= 100) return 'bg-green-500'
  if (progress >= 75) return 'bg-blue-500'
  if (progress >= 50) return 'bg-yellow-500'
  if (progress >= 25) return 'bg-orange-400'
  return 'bg-red-400'
}

function formatDeadline(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function calcMonthsRemaining(deadline: number): number {
  return (deadline - Date.now()) / (1000 * 60 * 60 * 24 * 30)
}

// ===== 主元件 =====

export function GoalsPage() {
  const { goals, isLoading, error, saveGoal, deleteGoal } = useGoals()
  const portfolios = usePortfolioStore((state) => state.portfolios)

  const [showModal, setShowModal] = useState(false)
  const [editGoal, setEditGoal] = useState<InvestmentGoal | null>(null)
  const [formData, setFormData] = useState<GoalFormData>(defaultFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ===== 計算有效當前金額 =====

  const getEffectiveCurrentAmount = (goal: InvestmentGoal): number => {
    if (goal.linkedPortfolioId) {
      const linked = portfolios.find((p) => p.id === goal.linkedPortfolioId)
      if (linked) return linked.totalValue
    }
    return goal.currentAmount
  }

  // ===== 統計 =====

  const totalGoals = goals.length
  const completedGoals = goals.filter((g) => g.isCompleted).length
  const activeGoals = totalGoals - completedGoals
  const totalTargetAmount = goals.reduce((sum, g) => sum + g.targetAmount, 0)

  // ===== 事件處理 =====

  const handleOpenAdd = () => {
    setFormData(defaultFormData)
    setEditGoal(null)
    setFormError(null)
    setShowModal(true)
  }

  const handleOpenEdit = (goal: InvestmentGoal) => {
    setFormData({
      name: goal.name,
      goalType: goal.goalType,
      priority: goal.priority,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      linkedPortfolioId: goal.linkedPortfolioId || '',
      deadline: goal.deadline
        ? new Date(goal.deadline).toISOString().split('T')[0]
        : '',
      monthlyContribution: goal.monthlyContribution
        ? goal.monthlyContribution.toString()
        : '',
      description: goal.description || '',
    })
    setEditGoal(goal)
    setFormError(null)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditGoal(null)
    setFormError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.name.trim()) {
      setFormError('請輸入目標名稱')
      return
    }
    if (!formData.targetAmount || parseFloat(formData.targetAmount) <= 0) {
      setFormError('目標金額必須大於 0')
      return
    }

    setIsSaving(true)
    try {
      const goal: InvestmentGoal = {
        id: editGoal?.id || `goal_${Date.now()}`,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        goalType: formData.goalType,
        priority: formData.priority,
        targetAmount: parseFloat(formData.targetAmount),
        currentAmount: parseFloat(formData.currentAmount) || 0,
        linkedPortfolioId: formData.linkedPortfolioId || undefined,
        deadline: formData.deadline
          ? new Date(formData.deadline).getTime()
          : undefined,
        monthlyContribution: parseFloat(formData.monthlyContribution) || 0,
        createdDate: editGoal?.createdDate || Date.now(),
        lastModified: Date.now(),
        isCompleted: editGoal?.isCompleted || false,
      }

      await saveGoal(goal)
      handleCloseModal()
    } catch (err) {
      setFormError('儲存失敗，請重試')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此目標嗎？')) return
    await deleteGoal(id)
  }

  const handleToggleComplete = async (goal: InvestmentGoal) => {
    await saveGoal({ ...goal, isCompleted: !goal.isCompleted, lastModified: Date.now() })
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // ===== 渲染 =====

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100">
      {/* 頁面頭部 */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-7 h-7 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">投資目標</h1>
                <p className="text-slate-500 text-sm mt-0.5">設定並追蹤您的財務里程碑</p>
              </div>
            </div>
            <button
              onClick={handleOpenAdd}
              className={`${getButtonClass('success')} flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              新增目標
            </button>
          </div>
        </div>
      </header>

      {/* 主內容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 統計欄 */}
        {totalGoals > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: '全部目標', value: totalGoals, color: 'text-slate-900' },
              { label: '進行中', value: activeGoals, color: 'text-blue-600' },
              { label: '已完成', value: completedGoals, color: 'text-green-600' },
              {
                label: '總目標金額',
                value: `$${totalTargetAmount.toLocaleString()}`,
                color: 'text-slate-900',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className={`${cardClass} text-center py-4`}>
                <p className="text-slate-500 text-xs mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 載入中 */}
        {isLoading && goals.length === 0 && (
          <div className="flex justify-center py-16">
            <div className={SPINNER_CLASS} />
          </div>
        )}

        {/* 錯誤 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* 空狀態 */}
        {!isLoading && goals.length === 0 && !error && (
          <div className={`${cardClass} text-center py-16`}>
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">還沒有設定目標</h3>
            <p className="text-slate-500 mb-6">設定財務目標，讓投資更有方向感</p>
            <button
              onClick={handleOpenAdd}
              className={`${getButtonClass('success')} inline-flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              建立第一個目標
            </button>
          </div>
        )}

        {/* 目標卡片 */}
        {goals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goals.map((goal) => {
              const effectiveAmount = getEffectiveCurrentAmount(goal)
              const progress =
                goal.targetAmount > 0
                  ? Math.min((effectiveAmount / goal.targetAmount) * 100, 100)
                  : 0
              const remaining = goal.targetAmount - effectiveAmount
              const monthsRemaining = goal.deadline
                ? calcMonthsRemaining(goal.deadline)
                : null
              const requiredMonthly =
                monthsRemaining && monthsRemaining > 0 && remaining > 0
                  ? remaining / monthsRemaining
                  : null
              const linkedPortfolio = goal.linkedPortfolioId
                ? portfolios.find((p) => p.id === goal.linkedPortfolioId)
                : null

              return (
                <div
                  key={goal.id}
                  className={`${cardClass} relative flex flex-col ${
                    goal.isCompleted ? 'opacity-75' : ''
                  }`}
                >
                  {/* 優先級標籤 + 狀態 */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        PRIORITY_CONFIG[goal.priority].className
                      }`}
                    >
                      {PRIORITY_CONFIG[goal.priority].label}優先
                    </span>
                    <button
                      onClick={() => handleToggleComplete(goal)}
                      className={`transition-colors ${
                        goal.isCompleted ? 'text-green-500' : 'text-slate-300 hover:text-green-400'
                      }`}
                      title={goal.isCompleted ? '標記為未完成' : '標記為完成'}
                    >
                      {goal.isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* 標題 */}
                  <div className="flex items-start gap-2 mb-4">
                    <span className="text-2xl">
                      {GOAL_TYPE_CONFIG[goal.goalType].emoji}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight">{goal.name}</h3>
                      <p className="text-xs text-slate-500">
                        {GOAL_TYPE_CONFIG[goal.goalType].label}
                      </p>
                      {goal.description && (
                        <p className="text-xs text-slate-500 mt-1">{goal.description}</p>
                      )}
                    </div>
                  </div>

                  {/* 進度條 */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-500">進度</span>
                      <span className="font-semibold text-slate-900">
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${getProgressBarColor(progress)}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* 金額資訊 */}
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">當前</span>
                      <span className="font-semibold text-slate-900">
                        ${effectiveAmount.toLocaleString()}
                        {linkedPortfolio && (
                          <span className="text-xs text-blue-600 ml-1">
                            ({linkedPortfolio.name})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">目標</span>
                      <span className="font-semibold text-slate-900">
                        ${goal.targetAmount.toLocaleString()}
                      </span>
                    </div>
                    {remaining > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">尚差</span>
                        <span className="font-semibold text-orange-600">
                          ${remaining.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 截止日期與月存資訊 */}
                  <div className="space-y-1.5 text-xs text-slate-500 mb-4 border-t border-slate-100 pt-3">
                    {goal.deadline && (
                      <div className="flex justify-between">
                        <span>截止日期</span>
                        <span className={`font-medium ${monthsRemaining && monthsRemaining < 6 ? 'text-red-600' : 'text-slate-700'}`}>
                          {formatDeadline(goal.deadline)}
                          {monthsRemaining !== null && monthsRemaining > 0 && (
                            <span className="ml-1">
                              ({Math.ceil(monthsRemaining)} 個月)
                            </span>
                          )}
                          {monthsRemaining !== null && monthsRemaining <= 0 && (
                            <span className="ml-1 text-red-600">已到期</span>
                          )}
                        </span>
                      </div>
                    )}
                    {goal.monthlyContribution > 0 && (
                      <div className="flex justify-between">
                        <span>計劃月存</span>
                        <span className="font-medium text-slate-700">
                          ${goal.monthlyContribution.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {requiredMonthly && requiredMonthly > 0 && (
                      <div className="flex justify-between">
                        <span>需月存</span>
                        <span
                          className={`font-medium ${
                            goal.monthlyContribution > 0 &&
                            requiredMonthly > goal.monthlyContribution
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          ${Math.ceil(requiredMonthly).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {goal.monthlyContribution > 0 && remaining > 0 && !goal.deadline && (
                      <div className="flex justify-between">
                        <span>預計達成</span>
                        <span className="font-medium text-slate-700">
                          {Math.ceil(remaining / goal.monthlyContribution)} 個月後
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 操作按鈕 */}
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => handleOpenEdit(goal)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      編輯
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      刪除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* 新增/編輯 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal 頭部 */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {editGoal ? '編輯目標' : '新增投資目標'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal 表單 */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  ⚠️ {formError}
                </div>
              )}

              {/* 名稱 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  目標名稱 *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="例如：買房頭期款"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  required
                />
              </div>

              {/* 類型 + 優先級 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">
                    目標類型
                  </label>
                  <select
                    name="goalType"
                    value={formData.goalType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    {Object.entries(GOAL_TYPE_CONFIG).map(([value, { label, emoji }]) => (
                      <option key={value} value={value}>
                        {emoji} {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">
                    優先級
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="HIGH">🔴 高優先</option>
                    <option value="MEDIUM">🟡 中優先</option>
                    <option value="LOW">🔵 低優先</option>
                  </select>
                </div>
              </div>

              {/* 目標金額 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  目標金額 (USD) *
                </label>
                <input
                  type="number"
                  name="targetAmount"
                  value={formData.targetAmount}
                  onChange={handleInputChange}
                  placeholder="例如：100000"
                  min="0"
                  step="100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  required
                />
              </div>

              {/* 關聯投資組合 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  關聯投資組合（自動追蹤市值）
                </label>
                <select
                  name="linkedPortfolioId"
                  value={formData.linkedPortfolioId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                >
                  <option value="">不關聯（手動輸入金額）</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.totalValue.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* 當前金額（當未關聯組合時顯示） */}
              {!formData.linkedPortfolioId && (
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">
                    當前已存金額 (USD)
                  </label>
                  <input
                    type="number"
                    name="currentAmount"
                    value={formData.currentAmount}
                    onChange={handleInputChange}
                    min="0"
                    step="100"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>
              )}

              {/* 截止日期 + 每月計劃 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">
                    截止日期（可選）
                  </label>
                  <input
                    type="date"
                    name="deadline"
                    value={formData.deadline}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">
                    每月計劃存入 ($)
                  </label>
                  <input
                    type="number"
                    name="monthlyContribution"
                    value={formData.monthlyContribution}
                    onChange={handleInputChange}
                    placeholder="500"
                    min="0"
                    step="50"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  描述（可選）
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="例如：2028年前存夠頭期款..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
                />
              </div>

              {/* 按鈕 */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`flex-1 ${getButtonClass('secondary')}`}
                  disabled={isSaving}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className={`flex-1 ${getButtonClass('success')}`}
                  disabled={isSaving}
                >
                  {isSaving ? '儲存中...' : editGoal ? '更新目標' : '建立目標'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default GoalsPage
