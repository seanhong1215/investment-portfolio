/**
 * 投資組合建立精靈
 *
 * 四步驟引導用戶建立屬於自己的投資組合：
 * Step 1：投資目標 + 年限
 * Step 2：風險承受度
 * Step 3：資金規劃
 * Step 4：專屬推薦方案 + 建立
 */

import { useState } from 'react'
import {
  ChevronRight, ChevronLeft, Wand2, CheckCircle,
  TrendingUp, AlertTriangle, Lightbulb, Target,
} from 'lucide-react'
import { cardClass } from '@/utils/classNames'
import {
  InvestorProfile, InvestGoal, TimeHorizon, RiskLevel,
  getRecommendation, GOAL_INFO, TIME_INFO, RISK_INFO,
  PortfolioRecommendation, AllocationItem,
} from '@/services/portfolioAdvisor'
import { usePortfolio } from '@/hooks/usePortfolio'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { storageService } from '@/services/storage'
import { Portfolio } from '@/types'

// ===== 進度列 =====

const STEPS = ['投資目標', '風險評估', '資金規劃', '專屬方案']

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < current  ? 'bg-blue-600 text-white' :
              i === current ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
              'bg-slate-200 text-slate-500'
            }`}>
              {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs mt-1 font-medium ${i === current ? 'text-blue-600' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-12 h-0.5 mb-4 mx-1 transition-all ${i < current ? 'bg-blue-600' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ===== Step 1：投資目標 =====

function Step1Goal({
  goal, timeHorizon, onChange,
}: {
  goal: InvestGoal | null
  timeHorizon: TimeHorizon | null
  onChange: (goal: InvestGoal, time: TimeHorizon) => void
}) {
  const [localGoal, setLocalGoal] = useState<InvestGoal | null>(goal)
  const [localTime, setLocalTime] = useState<TimeHorizon | null>(timeHorizon)

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">你的投資目標是什麼？</h2>
      <p className="text-slate-500 mb-6">選擇目標後，再設定你預計投資多久</p>

      {/* 目標選擇 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {(Object.keys(GOAL_INFO) as InvestGoal[]).map((g) => {
          const info = GOAL_INFO[g]
          return (
            <button
              key={g}
              onClick={() => { setLocalGoal(g); if (localTime) onChange(g, localTime) }}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                localGoal === g
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{info.icon}</span>
                <div>
                  <p className="font-semibold text-slate-900">{info.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{info.hint}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 年限選擇 */}
      <h3 className="font-semibold text-slate-900 mb-3">預計投資年限</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(TIME_INFO) as TimeHorizon[]).map((t) => {
          const info = TIME_INFO[t]
          return (
            <button
              key={t}
              onClick={() => { setLocalTime(t); if (localGoal) onChange(localGoal, t) }}
              className={`py-3 rounded-xl border-2 text-center transition-all font-medium text-sm ${
                localTime === t
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              {info.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ===== Step 2：風險評估 =====

const RISK_QUESTIONS = [
  {
    q: '市場突然下跌 25%，你的反應是？',
    options: [
      { label: '馬上賣掉，受不了虧損', value: 0 },
      { label: '有點擔心，但繼續持有', value: 1 },
      { label: '感到興奮，準備加碼買入', value: 2 },
    ],
  },
  {
    q: '這筆投資佔你總資產的比例大約是？',
    options: [
      { label: '超過 50%，這是主要積蓄', value: 0 },
      { label: '約 20-50%，有其他存款', value: 1 },
      { label: '低於 20%，閒置資金', value: 2 },
    ],
  },
  {
    q: '你對投資的了解程度？',
    options: [
      { label: '剛開始學，不太了解市場波動', value: 0 },
      { label: '有基本概念，知道長期持有的重要', value: 1 },
      { label: '熟悉市場，曾經歷多次市場週期', value: 2 },
    ],
  },
]

function Step2Risk({
  riskLevel, onChange,
}: {
  riskLevel: RiskLevel | null
  onChange: (r: RiskLevel) => void
}) {
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null])

  const handleAnswer = (qi: number, val: number) => {
    const next = [...answers]
    next[qi] = val
    setAnswers(next)

    if (next.every((a) => a !== null)) {
      const total = next.reduce((s, a) => s + (a ?? 0), 0)
      const level: RiskLevel = total <= 1 ? 'CONSERVATIVE' : total <= 3 ? 'BALANCED' : 'AGGRESSIVE'
      onChange(level)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">你的風險承受度</h2>
      <p className="text-slate-500 mb-6">回答 3 個情境題，幫助我們了解你適合哪種配置</p>

      <div className="space-y-6">
        {RISK_QUESTIONS.map((q, qi) => (
          <div key={qi} className="bg-slate-50 rounded-xl p-4">
            <p className="font-semibold text-slate-900 mb-3">
              Q{qi + 1}. {q.q}
            </p>
            <div className="space-y-2">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(qi, opt.value)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm ${
                    answers[qi] === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 結果顯示 */}
      {riskLevel && (
        <div className={`mt-6 p-4 rounded-xl border-2 border-blue-200 bg-blue-50`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{RISK_INFO[riskLevel].icon}</span>
            <p className="font-bold text-blue-900">
              你的風險類型：{RISK_INFO[riskLevel].label}派
            </p>
          </div>
          <p className="text-sm text-blue-700">{RISK_INFO[riskLevel].desc}</p>
        </div>
      )}
    </div>
  )
}

// ===== Step 3：資金規劃 =====

function Step3Budget({
  monthly, savings, onChange,
}: {
  monthly: number
  savings: number
  onChange: (monthly: number, savings: number) => void
}) {
  const [m, setM] = useState(monthly > 0 ? monthly.toString() : '')
  const [s, setS] = useState(savings > 0 ? savings.toString() : '')

  const update = (newM: string, newS: string) => {
    setM(newM); setS(newS)
    onChange(parseFloat(newM) || 0, parseFloat(newS) || 0)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">資金規劃</h2>
      <p className="text-slate-500 mb-6">設定你的投資預算，讓我們估算未來的成長潛力</p>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            每月可投入金額（美元）
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
            <input
              type="number"
              value={m}
              onChange={(e) => update(e.target.value, s)}
              placeholder="例如 500"
              min="0"
              className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">建議至少 $100/月，複利效果才明顯</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            目前已有的投資資金（美元）
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
            <input
              type="number"
              value={s}
              onChange={(e) => update(m, e.target.value)}
              placeholder="若目前為零請填 0"
              min="0"
              className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* 小提示 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">每月小錢的驚人複利</p>
              <p>每月投入 $500，年化 8% 報酬，20 年後約 <strong>$294,000</strong>。</p>
              <p className="mt-1">自己投入的本金只有 $120,000，其餘 $174,000 是複利創造的！</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Step 4：推薦方案 =====

function AllocationBar({ items, title }: { items: AllocationItem[]; title: string }) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
  ]
  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-slate-600 mb-2">{title}</p>
      {/* 比例條 */}
      <div className="flex h-4 rounded-full overflow-hidden mb-3 gap-0.5">
        {items.map((item, i) => (
          <div
            key={item.symbol}
            className={`${colors[i % colors.length]} transition-all`}
            style={{ width: `${item.percentage}%` }}
            title={`${item.symbol} ${item.percentage}%`}
          />
        ))}
      </div>
      {/* 明細 */}
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={item.symbol} className="flex items-start gap-2">
            <div className={`w-3 h-3 rounded-sm shrink-0 mt-0.5 ${colors[i % colors.length]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-900">{item.symbol}</span>
                <span className="text-sm font-bold text-slate-700">{item.percentage}%</span>
              </div>
              <p className="text-xs text-slate-500 truncate">{item.name} · {item.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectionCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-black text-slate-900">
        ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}

function Step4Result({
  rec,
  profile,
  onConfirm,
  isCreating,
}: {
  rec: PortfolioRecommendation
  profile: InvestorProfile
  onConfirm: () => void
  isCreating: boolean
}) {
  const etfPct = rec.etfCore.reduce((s, i) => s + i.percentage, 0)
  const stockPct = rec.stockSatellite.reduce((s, i) => s + i.percentage, 0)

  return (
    <div className="space-y-5">
      {/* 標題 */}
      <div className="text-center pb-2">
        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">你的專屬投資方案</p>
        <h2 className="text-3xl font-black text-slate-900">{rec.title}</h2>
        <p className="text-slate-500 text-sm mt-1">{rec.description}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-semibold">
            ETF 核心 {etfPct}%
          </span>
          {stockPct > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
              個股衛星 {stockPct}%
            </span>
          )}
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
            預期年化 {rec.expectedReturnMin}-{rec.expectedReturnMax}%
          </span>
        </div>
      </div>

      {/* 配置明細 */}
      <div className={cardClass}>
        {rec.etfCore.length > 0 && (
          <AllocationBar items={rec.etfCore} title="ETF 核心（自動化、免擇時）" />
        )}
        {rec.stockSatellite.length > 0 && (
          <>
            <div className="border-t border-slate-100 my-4" />
            <AllocationBar items={rec.stockSatellite} title="個股衛星（等買點機會）" />
          </>
        )}
      </div>

      {/* 買點策略 */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">買點策略</h3>
        </div>
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1">ETF 核心 — 無腦定期定額</p>
            <p className="text-sm text-emerald-800">{rec.buyStrategy.etfRule}</p>
          </div>
          {rec.stockSatellite.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">個股衛星 — 等待觸發條件</p>
              <p className="text-sm text-blue-800">{rec.buyStrategy.stockRule}</p>
            </div>
          )}
          {rec.buyStrategy.triggers.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">個股買入觸發條件（滿足其中 2 條即可行動）</p>
              <ul className="space-y-1">
                {rec.buyStrategy.triggers.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-blue-500 font-bold shrink-0">✓</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 資產預測 */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900">複利成長預測</h3>
          <span className="text-xs text-slate-400 ml-auto">
            每月 ${profile.monthlyContribution.toLocaleString()} + 現有 ${profile.currentSavings.toLocaleString()}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ProjectionCard label="5 年後" amount={rec.projections.year5} />
          <ProjectionCard label="10 年後" amount={rec.projections.year10} />
          <ProjectionCard label="20 年後" amount={rec.projections.year20} />
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          以年化 {rec.expectedReturnMin}-{rec.expectedReturnMax}% 中間值估算，實際結果因市場而異
        </p>
      </div>

      {/* 風險提示 */}
      {rec.warningNote && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{rec.warningNote}</p>
        </div>
      )}

      {/* 建立按鈕 */}
      <button
        onClick={onConfirm}
        disabled={isCreating}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isCreating ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            建立中...
          </>
        ) : (
          <>
            <Wand2 className="w-5 h-5" />
            建立「{rec.title}」投資組合
          </>
        )}
      </button>
      <p className="text-xs text-slate-400 text-center -mt-2">
        建立後會自動加入觀察清單，方便追蹤買點
      </p>
    </div>
  )
}

// ===== 主頁面 =====

export function PortfolioBuilderPage() {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // 用戶輸入
  const [goal, setGoal] = useState<InvestGoal | null>(null)
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon | null>(null)
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null)
  const [monthly, setMonthly] = useState(0)
  const [savings, setSavings] = useState(0)

  const { savePortfolio } = usePortfolio()
  const setActivePortfolio = usePortfolioStore((s) => s.setActivePortfolio)
  const addWatchlistItem = useWatchlistStore((s) => s.addItem)

  // 是否可以進入下一步
  const canNext = [
    goal !== null && timeHorizon !== null,
    riskLevel !== null,
    monthly > 0,
  ][step] ?? true

  const profile: InvestorProfile | null =
    goal && timeHorizon && riskLevel
      ? { goal, timeHorizon, riskLevel, monthlyContribution: monthly, currentSavings: savings }
      : null

  const rec = profile ? getRecommendation(profile) : null

  const handleCreate = async () => {
    if (!rec || !profile) return
    setIsCreating(true)

    try {
      const portfolioId = `portfolio_${Date.now()}`
      const goalMap: Record<InvestGoal, Portfolio['investmentGoal']> = {
        RETIREMENT: 'RETIREMENT', HOME: 'HOME', FREEDOM: 'SAVINGS',
        EDUCATION: 'EDUCATION', EMERGENCY: 'SAVINGS',
      }
      const yearsMap: Record<TimeHorizon, number> = {
        SHORT: 2, MEDIUM: 4, LONG: 7, VERY_LONG: 15,
      }

      const portfolio: Portfolio = {
        id: portfolioId,
        name: rec.title,
        description: `${GOAL_INFO[profile.goal].label} · 每月投入 $${profile.monthlyContribution}`,
        items: [],
        targetAmount: rec.projections.year10,
        totalInvested: profile.currentSavings,
        totalValue: profile.currentSavings,
        totalGain: 0,
        totalGainPercent: 0,
        investmentGoal: goalMap[profile.goal],
        investmentYears: yearsMap[profile.timeHorizon],
        createdDate: Date.now(),
        lastModified: Date.now(),
        isDefault: false,
      }

      await savePortfolio(portfolio)
      setActivePortfolio(portfolioId)

      // 把推薦個股加入觀察清單
      for (const item of [...rec.etfCore, ...rec.stockSatellite]) {
        const watchlistItem = {
          id: `watchlist_${item.symbol}_${Date.now()}`,
          symbol: item.symbol,
          name: item.name,
          type: item.type,
          addedDate: Date.now(),
          notes: `${rec.title} 推薦配置 ${item.percentage}%：${item.reason}`,
        }
        addWatchlistItem(watchlistItem)
        await storageService.saveWatchlistItem(watchlistItem)
      }

      setDone(true)
    } catch (err) {
      console.error('建立投資組合失敗:', err)
    } finally {
      setIsCreating(false)
    }
  }

  // ===== 完成畫面 =====

  if (done && rec) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">投資組合已建立！</h2>
          <p className="text-slate-600 mb-6">
            「{rec.title}」已建立完成，推薦的 {[...rec.etfCore, ...rec.stockSatellite].length} 支
            ETF / 個股已加入觀察清單。
          </p>
          <div className="bg-white rounded-2xl shadow-lg p-5 mb-6 text-left">
            <p className="font-semibold text-slate-900 mb-3">接下來做什麼？</p>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <span className="text-blue-500 font-bold shrink-0">1.</span>
                <p>前往「<strong>投資組合</strong>」頁面，開始記錄每次買入</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 font-bold shrink-0">2.</span>
                <p>前往「<strong>觀察清單</strong>」查看推薦的 ETF / 個股</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 font-bold shrink-0">3.</span>
                <p>使用「<strong>巴菲特選股</strong>」分析個股，等待觸發條件出現</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 font-bold shrink-0">4.</span>
                <p>ETF 核心：<strong>每月固定日</strong>定期定額，不需等買點</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            ⚠️ 本建議僅供參考，不構成投資建議。請自行判斷並承擔投資風險。
          </p>
        </div>
      </div>
    )
  }

  // ===== 精靈主畫面 =====

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <Wand2 className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">投資組合建立精靈</h1>
              <p className="text-sm text-slate-500">4 步驟建立屬於你的專屬投資組合</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <StepBar current={step} />

        <div className={cardClass}>
          {step === 0 && (
            <Step1Goal
              goal={goal}
              timeHorizon={timeHorizon}
              onChange={(g, t) => { setGoal(g); setTimeHorizon(t) }}
            />
          )}
          {step === 1 && (
            <Step2Risk
              riskLevel={riskLevel}
              onChange={setRiskLevel}
            />
          )}
          {step === 2 && (
            <Step3Budget
              monthly={monthly}
              savings={savings}
              onChange={(m, s) => { setMonthly(m); setSavings(s) }}
            />
          )}
          {step === 3 && rec && profile && (
            <Step4Result
              rec={rec}
              profile={profile}
              onConfirm={handleCreate}
              isCreating={isCreating}
            />
          )}

          {/* 導航按鈕（Step 4 由內部的建立按鈕控制） */}
          {step < 3 && (
            <div className={`flex ${step > 0 ? 'justify-between' : 'justify-end'} mt-8`}>
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex items-center gap-1 px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition"
                >
                  <ChevronLeft className="w-4 h-4" /> 上一步
                </button>
              )}
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                className="flex items-center gap-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === 2 ? '查看推薦方案' : '下一步'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {step === 3 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 mt-4 px-4 py-2 text-slate-500 hover:text-slate-700 font-medium transition"
            >
              <ChevronLeft className="w-4 h-4" /> 修改設定
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

export default PortfolioBuilderPage
