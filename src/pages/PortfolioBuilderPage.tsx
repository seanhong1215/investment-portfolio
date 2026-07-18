/**
 * 投資組合建立精靈 — 四步驟問卷產生個人化配置。
 *
 * Step 1 目標與年限 → Step 2 風險評估 → Step 3 資金規劃 → Step 4 專屬方案。
 * 所有推薦邏輯都在 domain/advisor.ts（純函數、有測試），本頁只負責蒐集
 * 輸入與呈現結果。
 */

import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, GraduationCap, Home, Landmark,
  LineChart, Rocket, Scale, Shield, Sparkles, Target, TrendingUp, Umbrella, Wand2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  getRecommendation,
  GOAL_INFO, TIME_INFO, RISK_INFO,
  type InvestGoal, type TimeHorizon, type RiskLevel,
  type InvestorProfile, type PortfolioRecommendation, type AllocationItem,
} from '@/domain/advisor'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { Button, Card, Badge, StatTile } from '@/components/ui'
import { foldToSlots } from '@/components/charts/series'
import { formatCurrency, formatPercent } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Portfolio, PortfolioItem } from '@/types'

const STEPS = ['投資目標', '風險評估', '資金規劃', '專屬方案']

const GOAL_ICONS: Record<InvestGoal, LucideIcon> = {
  RETIREMENT: Umbrella,
  HOME: Home,
  FREEDOM: Rocket,
  EDUCATION: GraduationCap,
  EMERGENCY: Shield,
}

const RISK_ICONS: Record<RiskLevel, LucideIcon> = {
  CONSERVATIVE: Shield,
  BALANCED: Scale,
  AGGRESSIVE: Rocket,
}

// ── 進度列 ──

function StepBar({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center justify-center">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  done && 'bg-accent text-white',
                  active && 'bg-accent text-white ring-4 ring-accent-wash',
                  !done && !active && 'bg-surface-sunken text-ink-muted'
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn('mt-1.5 text-xs', active ? 'font-medium text-accent' : 'text-ink-muted')}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('mx-2 mb-5 h-px w-10 transition-colors', done ? 'bg-accent' : 'bg-line')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── Step 1：目標與年限 ──

function StepGoal({
  goal, timeHorizon, onChange,
}: {
  goal: InvestGoal | null
  timeHorizon: TimeHorizon | null
  onChange: (goal: InvestGoal | null, time: TimeHorizon | null) => void
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">你的投資目標是什麼？</h2>
      <p className="mt-1 text-sm text-ink-muted">選擇目標後，再設定預計投資多久。</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(Object.keys(GOAL_INFO) as InvestGoal[]).map((g) => {
          const info = GOAL_INFO[g]
          const Icon = GOAL_ICONS[g]
          const selected = goal === g
          return (
            <button
              key={g}
              type="button"
              onClick={() => onChange(g, timeHorizon)}
              aria-pressed={selected}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                selected ? 'border-accent bg-accent-wash' : 'border-line hover:border-line-strong'
              )}
            >
              <span className={cn('rounded-lg p-2', selected ? 'bg-accent text-white' : 'bg-surface-sunken text-ink-secondary')}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block font-medium">{info.label}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{info.hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      <h3 className="mt-8 text-sm font-semibold">預計投資年限</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(TIME_INFO) as TimeHorizon[]).map((t) => {
          const selected = timeHorizon === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(goal, t)}
              aria-pressed={selected}
              className={cn(
                'rounded-xl border py-3 text-center text-sm font-medium transition-colors',
                selected ? 'border-accent bg-accent-wash text-accent' : 'border-line text-ink-secondary hover:border-line-strong'
              )}
            >
              {TIME_INFO[t].label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2：風險評估 ──

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
      { label: '約 20 ~ 50%，有其他存款', value: 1 },
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

function StepRisk({
  riskLevel, onChange,
}: {
  riskLevel: RiskLevel | null
  onChange: (r: RiskLevel) => void
}) {
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null])

  const handleAnswer = (qi: number, value: number) => {
    const next = [...answers]
    next[qi] = value
    setAnswers(next)

    if (next.every((a) => a !== null)) {
      const total = next.reduce((sum, a) => sum + (a ?? 0), 0)
      onChange(total <= 1 ? 'CONSERVATIVE' : total <= 3 ? 'BALANCED' : 'AGGRESSIVE')
    }
  }

  const RiskIcon = riskLevel ? RISK_ICONS[riskLevel] : null

  return (
    <div>
      <h2 className="text-xl font-semibold">你的風險承受度</h2>
      <p className="mt-1 text-sm text-ink-muted">回答 3 個情境題，幫助判斷你適合哪種配置。</p>

      <div className="mt-5 space-y-5">
        {RISK_QUESTIONS.map((question, qi) => (
          <fieldset key={qi} className="rounded-xl border border-line bg-surface-sunken p-4">
            <legend className="px-1 text-sm font-medium">Q{qi + 1}. {question.q}</legend>
            <div className="mt-2 space-y-2">
              {question.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleAnswer(qi, opt.value)}
                  aria-pressed={answers[qi] === opt.value}
                  className={cn(
                    'w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-colors',
                    answers[qi] === opt.value
                      ? 'border-accent bg-accent-wash font-medium text-accent'
                      : 'border-line bg-surface text-ink-secondary hover:border-line-strong'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {riskLevel && RiskIcon && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-wash p-4">
          <RiskIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div>
            <p className="font-medium text-accent">你的風險類型：{RISK_INFO[riskLevel].label}</p>
            <p className="mt-0.5 text-sm text-ink-secondary">{RISK_INFO[riskLevel].desc}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 3：資金規劃 ──

const MONEY_INPUT_CLASS =
  'w-full rounded-lg border border-line-strong bg-surface py-2.5 pl-7 pr-3 text-sm ' +
  'placeholder:text-ink-muted focus:border-accent focus:outline-none'

function StepBudget({
  monthly, savings, onChange,
}: {
  monthly: number
  savings: number
  onChange: (monthly: number, savings: number) => void
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">資金規劃</h2>
      <p className="mt-1 text-sm text-ink-muted">設定投資預算，用來估算未來的複利成長。</p>

      <div className="mt-5 space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">每月可投入金額</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">$</span>
            <input
              type="number"
              min="0"
              value={monthly || ''}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0, savings)}
              placeholder="例如 500"
              className={MONEY_INPUT_CLASS}
            />
          </div>
          <span className="mt-1 block text-xs text-ink-muted">建議至少 $100／月，複利效果才明顯。</span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">目前已有的投資資金</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">$</span>
            <input
              type="number"
              min="0"
              value={savings || ''}
              onChange={(e) => onChange(monthly, parseFloat(e.target.value) || 0)}
              placeholder="若目前為零請填 0"
              className={MONEY_INPUT_CLASS}
            />
          </div>
        </label>
      </div>
    </div>
  )
}

// ── Step 4：專屬方案 ──

/** 推薦配置的迷你堆疊條 + 明細。配置固定 ≤7 檔，色票夠用不需折疊，但仍走同一套色系。 */
function RecommendationAllocation({ title, items }: { title: string; items: AllocationItem[] }) {
  const folded = foldToSlots(items, (i) => i.symbol, (i) => i.percentage)

  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-2 flex h-6 gap-0.5 overflow-hidden rounded-md">
        {folded.map((slice) => (
          <div
            key={slice.key}
            title={`${slice.label} ${formatPercent(slice.value, 0)}`}
            style={{ width: `${slice.value}%`, backgroundColor: slice.color }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((item, i) => (
          <li key={item.symbol} className="flex items-start gap-2 text-sm">
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: `var(--series-${(i % 8) + 1})` }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.symbol}</span>
                <span className="tabular text-ink-secondary">{formatPercent(item.percentage, 0)}</span>
              </div>
              <p className="truncate text-xs text-ink-muted">{item.name} · {item.reason}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StepResult({
  rec, onConfirm, isCreating,
}: {
  rec: PortfolioRecommendation
  onConfirm: () => void
  isCreating: boolean
}) {
  const etfPct = rec.etfCore.reduce((sum, i) => sum + i.percentage, 0)
  const stockPct = rec.stockSatellite.reduce((sum, i) => sum + i.percentage, 0)

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">你的專屬投資方案</p>
        <h2 className="mt-1 text-2xl font-semibold">{rec.title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{rec.description}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="accent">ETF 核心 {etfPct}%</Badge>
          {stockPct > 0 && <Badge>個股衛星 {stockPct}%</Badge>}
          <Badge>預期年化 {rec.expectedReturnMin}–{rec.expectedReturnMax}%</Badge>
        </div>
      </div>

      <Card className="p-5">
        <RecommendationAllocation title="ETF 核心（定期定額、免擇時）" items={rec.etfCore} />
        {rec.stockSatellite.length > 0 && (
          <div className="mt-5 border-t border-line pt-5">
            <RecommendationAllocation title="個股衛星（等買點機會）" items={rec.stockSatellite} />
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-accent" aria-hidden />
          <h3 className="text-sm font-semibold">買點策略</h3>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <p className="rounded-lg bg-surface-sunken px-3 py-2">
            <span className="font-medium">ETF 核心：</span>
            <span className="text-ink-secondary">{rec.buyStrategy.etfRule}</span>
          </p>
          {rec.stockSatellite.length > 0 && (
            <p className="rounded-lg bg-surface-sunken px-3 py-2">
              <span className="font-medium">個股衛星：</span>
              <span className="text-ink-secondary">{rec.buyStrategy.stockRule}</span>
            </p>
          )}
          {rec.buyStrategy.triggers.length > 0 && (
            <div className="rounded-lg bg-surface-sunken px-3 py-2">
              <p className="font-medium">個股買入觸發條件</p>
              <ul className="mt-1.5 space-y-1">
                {rec.buyStrategy.triggers.map((trigger, i) => (
                  <li key={i} className="flex items-start gap-2 text-ink-secondary">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                    {trigger}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" aria-hidden />
          <h3 className="text-sm font-semibold">複利成長預測</h3>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatTile label="5 年後" value={formatCurrency(rec.projections.year5)} />
          <StatTile label="10 年後" value={formatCurrency(rec.projections.year10)} />
          <StatTile label="20 年後" value={formatCurrency(rec.projections.year20)} />
        </div>
        <p className="mt-3 text-center text-xs text-ink-muted">
          以年化 {rec.expectedReturnMin}–{rec.expectedReturnMax}% 中間值估算，實際結果因市場而異。
        </p>
      </Card>

      {rec.warningNote && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-ink-secondary" aria-hidden />
          <p className="text-ink-secondary">{rec.warningNote}</p>
        </div>
      )}

      <Button className="w-full" size="lg" onClick={onConfirm} isLoading={isCreating}>
        <Wand2 className="h-4 w-4" aria-hidden />
        建立「{rec.title}」投資組合
      </Button>
      <p className="text-center text-xs text-ink-muted">
        本建議僅供參考，不構成投資建議。請自行判斷並承擔投資風險。
      </p>
    </div>
  )
}

// ── 把推薦方案轉成實際持倉 ──

const GOAL_TO_PORTFOLIO: Record<InvestGoal, Portfolio['investmentGoal']> = {
  RETIREMENT: 'RETIREMENT',
  HOME: 'HOME',
  FREEDOM: 'SAVINGS',
  EDUCATION: 'EDUCATION',
  EMERGENCY: 'SAVINGS',
}

const HORIZON_TO_YEARS: Record<TimeHorizon, number> = {
  SHORT: 2, MEDIUM: 4, LONG: 7, VERY_LONG: 15,
}

/**
 * 把推薦的 ETF + 個股轉成持倉骨架（金額為 0，等使用者填入實際買入）。
 * 原本這裡是 items: []，等於精心計算的配置完全沒被用上 ——
 * 建出來的組合和隨手新建一個空組合毫無差別。
 */
function buildPortfolio(rec: PortfolioRecommendation, profile: InvestorProfile): Portfolio {
  const items: PortfolioItem[] = [...rec.etfCore, ...rec.stockSatellite].map((item) => ({
    id: `item_${crypto.randomUUID()}`,
    stock: {
      symbol: item.symbol,
      name: item.name,
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
    notes: item.reason,
  }))

  return {
    id: `portfolio_${crypto.randomUUID()}`,
    name: rec.title,
    description: `${GOAL_INFO[profile.goal].label} · 每月投入 ${formatCurrency(profile.monthlyContribution)}`,
    items,
    targetAmount: rec.projections.year10,
    totalInvested: 0,
    totalValue: 0,
    totalGain: 0,
    totalGainPercent: 0,
    investmentGoal: GOAL_TO_PORTFOLIO[profile.goal],
    investmentYears: HORIZON_TO_YEARS[profile.timeHorizon],
    createdDate: Date.now(),
    lastModified: Date.now(),
    isDefault: false,
  }
}

// ── 主頁面 ──

export function PortfolioBuilderPage() {
  const savePortfolio = usePortfolioStore((s) => s.savePortfolio)
  const setActivePortfolio = usePortfolioStore((s) => s.setActivePortfolio)

  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [goal, setGoal] = useState<InvestGoal | null>(null)
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon | null>(null)
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null)
  const [monthly, setMonthly] = useState(0)
  const [savings, setSavings] = useState(0)

  const profile: InvestorProfile | null =
    goal && timeHorizon && riskLevel
      ? { goal, timeHorizon, riskLevel, monthlyContribution: monthly, currentSavings: savings }
      : null

  // getRecommendation 是純函數，用 useMemo 避免每次 render 重算整組配置
  const rec = useMemo(() => (profile ? getRecommendation(profile) : null), [profile])

  const canAdvance = [
    goal !== null && timeHorizon !== null,
    riskLevel !== null,
    monthly > 0,
  ][step] ?? true

  const handleCreate = async () => {
    if (!rec || !profile) return
    setIsCreating(true)
    setError(null)

    try {
      const portfolio = buildPortfolio(rec, profile)
      await savePortfolio(portfolio)
      setActivePortfolio(portfolio.id)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立投資組合失敗')
    } finally {
      setIsCreating(false)
    }
  }

  if (done && rec) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good/10">
          <Check className="h-7 w-7 text-good" aria-hidden />
        </div>
        <h2 className="mt-5 text-xl font-semibold">投資組合已建立</h2>
        <p className="mt-2 text-sm text-ink-muted">
          「{rec.title}」已建立完成，包含 {[...rec.etfCore, ...rec.stockSatellite].length} 檔標的的配置骨架。
          到「投資組合」頁面即可開始記錄每次買入。
        </p>
        <Card className="mt-6 p-5 text-left">
          <p className="text-sm font-medium">接下來</p>
          <ul className="mt-2 space-y-2 text-sm text-ink-secondary">
            <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />到「投資組合」逐筆填入實際買入金額</li>
            <li className="flex gap-2"><LineChart className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />用「個股研究」分析個股，等待買點出現</li>
            <li className="flex gap-2"><Landmark className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />ETF 核心每月固定日定期定額，不需擇時</li>
          </ul>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center gap-3">
        <span className="rounded-lg bg-accent-wash p-2">
          <Wand2 className="h-5 w-5 text-accent" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold">投資組合建立精靈</h1>
          <p className="text-sm text-ink-muted">四步驟建立屬於你的專屬配置</p>
        </div>
      </header>

      <StepBar current={step} />

      <Card className="p-6">
        {step === 0 && (
          <StepGoal
            goal={goal}
            timeHorizon={timeHorizon}
            onChange={(g, t) => { setGoal(g); setTimeHorizon(t) }}
          />
        )}
        {step === 1 && <StepRisk riskLevel={riskLevel} onChange={setRiskLevel} />}
        {step === 2 && (
          <StepBudget
            monthly={monthly}
            savings={savings}
            onChange={(m, s) => { setMonthly(m); setSavings(s) }}
          />
        )}
        {step === 3 && rec && profile && (
          <StepResult rec={rec} onConfirm={handleCreate} isCreating={isCreating} />
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-critical/30 bg-critical/5 px-3 py-2 text-sm text-critical">
            {error}
          </p>
        )}
      </Card>

      {step < 3 && (
        <div className="mt-5 flex justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className={cn(step === 0 && 'invisible')}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            上一步
          </Button>
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
            下一步
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="mt-5">
          <Button variant="ghost" onClick={() => setStep(2)}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            調整資金規劃
          </Button>
        </div>
      )}
    </div>
  )
}

export default PortfolioBuilderPage
