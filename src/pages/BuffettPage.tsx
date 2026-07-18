/**
 * 個股研究 — 價值投資分析。
 *
 * 兩種資料來源：
 * 1. API 查詢：Alpha Vantage 自動抓取（免費版每日 25 次）。
 * 2. 手動輸入：從 Yahoo Finance 等免費來源自行填入，不消耗 API 配額。
 *
 * 所有評分與估值邏輯都在 domain/buffett.ts（純函數、有測試），
 * 本頁只負責蒐集輸入與呈現結果。
 */

import { useState } from 'react'
import {
  AlertTriangle, Check, ChevronDown, ChevronUp, Info, Minus,
  PencilLine, Search, Shield, Target, TrendingUp, Wifi, X, Zap,
} from 'lucide-react'
import { stockAPIService } from '@/services/stockAPI'
import { analyzeBuffett, calcBuySignals, calcFairValue } from '@/domain/buffett'
import { Button, Card, Badge, EmptyState } from '@/components/ui'
import { formatSignedPercent } from '@/utils/format'
import { cn } from '@/utils/cn'
import type {
  BuffettAnalysis, BuffettCriterion, BuySignal, BuySignalResult,
  CompanyOverview, FairValueResult,
} from '@/types'

// ── 手動輸入 ──

interface ManualForm {
  symbol: string
  name: string
  roe: string
  debtToEquity: string
  profitMargin: string
  peRatio: string
  earningsGrowthYOY: string
  currentRatio: string
  eps: string
  bookValue: string
  pegRatio: string
  dividendYield: string
  week52High: string
  week52Low: string
  movingAvg200: string
  analystTargetPrice: string
}

const EMPTY_FORM: ManualForm = {
  symbol: '', name: '',
  roe: '', debtToEquity: '', profitMargin: '', peRatio: '',
  earningsGrowthYOY: '', currentRatio: '',
  eps: '', bookValue: '', pegRatio: '', dividendYield: '',
  week52High: '', week52Low: '', movingAvg200: '', analystTargetPrice: '',
}

function formToOverview(form: ManualForm): CompanyOverview {
  const p = (v: string) => parseFloat(v) || 0
  return {
    symbol: form.symbol.toUpperCase(),
    name: form.name || form.symbol.toUpperCase(),
    sector: '', industry: '', marketCap: 0,
    peRatio: p(form.peRatio),
    pegRatio: p(form.pegRatio),
    roe: p(form.roe),
    debtToEquity: p(form.debtToEquity),
    profitMargin: p(form.profitMargin),
    operatingMargin: 0,
    revenueGrowthYOY: 0,
    earningsGrowthYOY: p(form.earningsGrowthYOY),
    dividendYield: p(form.dividendYield),
    bookValue: p(form.bookValue),
    priceToBook: 0,
    eps: p(form.eps),
    currentRatio: p(form.currentRatio),
    week52High: p(form.week52High),
    week52Low: p(form.week52Low),
    movingAvg50: 0,
    movingAvg200: p(form.movingAvg200),
    analystTargetPrice: p(form.analystTargetPrice),
  }
}

const FIELD_INPUT_CLASS =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm ' +
  'placeholder:text-ink-muted focus:border-accent focus:outline-none'

function Field({
  label, value, onChange, placeholder, hint, type = 'number',
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  hint?: string
  type?: 'text' | 'number'
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step="any"
        min={type === 'number' ? '0' : undefined}
        className={FIELD_INPUT_CLASS}
      />
      {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

function ManualInputForm({ onAnalyze }: { onAnalyze: (ov: CompanyOverview) => void }) {
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM)
  const [showOptional, setShowOptional] = useState(false)

  const set = (key: keyof ManualForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const canSubmit = form.symbol.trim() !== '' && parseFloat(form.roe) > 0 && parseFloat(form.peRatio) > 0

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onAnalyze(formToOverview(form)) }}
      className="mt-4 space-y-4"
    >
      <div className="rounded-lg border border-line bg-surface-sunken p-3 text-xs text-ink-secondary">
        <p className="font-medium text-ink">資料來源：Yahoo Finance（免費）</p>
        <p className="mt-1">Summary 頁查 P/E、EPS、52 週高低、200 日均線、股息率；Statistics 頁查 ROE、D/E、利潤率、流動比率、帳面價值、PEG；Analysis 頁查分析師目標價。</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="股票代碼 *" value={form.symbol} onChange={set('symbol')} placeholder="AAPL" type="text" />
        <Field label="公司名稱" value={form.name} onChange={set('name')} placeholder="Apple Inc." type="text" />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">巴菲特分析必填（6 項）</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ROE 股東權益報酬率 (%)" value={form.roe} onChange={set('roe')} placeholder="25.0" />
          <Field label="負債股權比 D/E (倍)" value={form.debtToEquity} onChange={set('debtToEquity')} placeholder="0.50" />
          <Field label="淨利率 (%)" value={form.profitMargin} onChange={set('profitMargin')} placeholder="25.0" />
          <Field label="本益比 P/E (倍)" value={form.peRatio} onChange={set('peRatio')} placeholder="28.0" />
          <Field label="季度盈餘年增率 (%)" value={form.earningsGrowthYOY} onChange={set('earningsGrowthYOY')} placeholder="15.0" />
          <Field label="流動比率 (倍)" value={form.currentRatio} onChange={set('currentRatio')} placeholder="1.50" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowOptional((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
      >
        {showOptional ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        選填欄位（買點訊號 + 合理進場價）
      </button>

      {showOptional && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">選填（填越多，買點訊號越準確）</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="每股盈餘 EPS ($)" value={form.eps} onChange={set('eps')} placeholder="6.11" />
            <Field label="每股帳面價值 ($)" value={form.bookValue} onChange={set('bookValue')} placeholder="4.84" />
            <Field label="PEG 比率" value={form.pegRatio} onChange={set('pegRatio')} placeholder="1.85" />
            <Field label="股息率 (%)" value={form.dividendYield} onChange={set('dividendYield')} placeholder="0.50" />
            <Field label="52 週最高價 ($)" value={form.week52High} onChange={set('week52High')} placeholder="237.23" />
            <Field label="52 週最低價 ($)" value={form.week52Low} onChange={set('week52Low')} placeholder="164.08" />
            <Field label="200 日均線 ($)" value={form.movingAvg200} onChange={set('movingAvg200')} placeholder="195.40" />
            <Field label="分析師目標價 ($)" value={form.analystTargetPrice} onChange={set('analystTargetPrice')} placeholder="243.00" />
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={!canSubmit}>開始分析</Button>
    </form>
  )
}

// ── 評分視覺 ──
// 評級 A~F 是品質判斷，屬於狀態語意，因此用狀態色 —— 但字母本身永遠顯示，
// 顏色只是輔助，符合「狀態不靠顏色單獨表意」的規則。

type Tone = 'good' | 'accent' | 'warning' | 'critical'

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-good',
  accent: 'text-accent',
  warning: 'text-ink',
  critical: 'text-critical',
}
const TONE_BG: Record<Tone, string> = {
  good: 'bg-good/10 border-good/30',
  accent: 'bg-accent-wash border-accent/30',
  warning: 'bg-warning/10 border-warning/40',
  critical: 'bg-critical/5 border-critical/30',
}

function scoreTone(score: number): Tone {
  if (score >= 75) return 'good'
  if (score >= 60) return 'accent'
  if (score >= 45) return 'warning'
  return 'critical'
}

const GRADE_TONE: Record<BuffettAnalysis['grade'], Tone> = {
  A: 'good', B: 'accent', C: 'warning', D: 'warning', F: 'critical',
}

const RECOMMENDATION_LABEL: Record<BuffettAnalysis['recommendation'], { label: string; tone: Tone }> = {
  STRONG_BUY: { label: '強力買進', tone: 'good' },
  BUY: { label: '可以買進', tone: 'accent' },
  HOLD: { label: '持有觀望', tone: 'warning' },
  AVOID: { label: '避免投資', tone: 'critical' },
}

const MOAT_LABEL: Record<BuffettAnalysis['moatStrength'], string> = {
  WIDE: '寬護城河', NARROW: '窄護城河', NONE: '護城河不明顯',
}

function ScoreBar({ score, weight }: { score: number; weight: number }) {
  const percent = weight > 0 ? Math.round((score / weight) * 100) : 0
  const tone = scoreTone(percent)
  const barColor: Record<Tone, string> = {
    good: 'bg-good', accent: 'bg-accent', warning: 'bg-warning', critical: 'bg-critical',
  }
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <div className={cn('h-full rounded-full', barColor[tone])} style={{ width: `${percent}%` }} />
      </div>
      {/* 分數永遠以文字顯示，不靠長條顏色單獨表意 */}
      <span className="w-14 text-right text-xs tabular text-ink-muted">{score}/{weight} 分</span>
    </div>
  )
}

function CriterionCard({ criterion }: { criterion: BuffettCriterion }) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {criterion.pass
            ? <Check className="h-4 w-4 shrink-0 text-good" aria-hidden />
            : <X className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />}
          <span className="text-sm font-medium">{criterion.name}</span>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="說明"
            aria-expanded={showInfo}
            className="text-ink-muted hover:text-ink"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <span className={cn('text-sm font-semibold tabular', criterion.pass ? 'text-ink' : 'text-ink-secondary')}>
          {criterion.displayValue}
        </span>
      </div>

      {showInfo && <p className="mt-2 pl-6 text-xs text-ink-muted">{criterion.description}</p>}

      <div className="mt-2 pl-6">
        <ScoreBar score={criterion.score} weight={criterion.weight} />
        <p className="mt-1 text-xs text-ink-muted">標準：{criterion.benchmark}</p>
      </div>
    </div>
  )
}

// ── 合理價 ──

function PriceStat({ label, price, hint, highlighted = false }: {
  label: string; price: number; hint: string; highlighted?: boolean
}) {
  return (
    <div className={cn('rounded-lg border p-3 text-center', highlighted ? 'border-accent/30 bg-accent-wash' : 'border-line')}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={cn('mt-1 text-lg font-semibold tabular', highlighted && 'text-accent')}>${price.toFixed(2)}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
    </div>
  )
}

const FAIR_VALUE_VERDICT: Record<FairValueResult['verdict'], { label: string; tone: Tone }> = {
  UNDERVALUED: { label: '低估 — 目前可能是買點', tone: 'good' },
  FAIR: { label: '合理估值區間', tone: 'accent' },
  OVERVALUED: { label: '略微高估，可等回調', tone: 'warning' },
  EXPENSIVE: { label: '嚴重高估，風險極高', tone: 'critical' },
}

function FairValueSection({ fairValue }: { fairValue: FairValueResult }) {
  if (!fairValue.canCalculate) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold">合理價格估算</h3>
        <p className="mt-2 text-sm text-ink-muted">
          需要 EPS 與每股帳面價值才能計算。手動輸入模式請在選填欄位補上這兩項。
        </p>
      </Card>
    )
  }

  const verdict = FAIR_VALUE_VERDICT[fairValue.verdict]

  return (
    <Card className={cn('border p-5', TONE_BG[verdict.tone])}>
      <h3 className="text-sm font-semibold">合理價格估算</h3>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
        <span className={cn('font-medium', TONE_TEXT[verdict.tone])}>{verdict.label}</span>
        <span className="text-sm tabular text-ink-secondary">
          {formatSignedPercent(fairValue.premiumDiscount, 1)} 溢／折價
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {fairValue.grahamNumber !== null && fairValue.grahamNumber > 0 && (
          <PriceStat label="葛拉漢公式" price={fairValue.grahamNumber} hint="√(22.5 × EPS × 帳面值)" />
        )}
        {fairValue.pegFairValue !== null && fairValue.pegFairValue > 0 && (
          <PriceStat label="PEG=1 原則" price={fairValue.pegFairValue} hint="EPS × 盈餘成長率" />
        )}
        {fairValue.conservativeValue !== null && fairValue.conservativeValue > 0 && (
          <PriceStat label="保守 P/E 法" price={fairValue.conservativeValue} hint="EPS × 15" />
        )}
        <PriceStat label="合理中間值" price={fairValue.fairValueMid} hint="三法平均" highlighted />
      </div>

      <div className="mt-4 rounded-lg border border-good/30 bg-good/10 p-4 text-center">
        <p className="text-xs font-medium text-good">建議買入價（含 25% 安全邊際）</p>
        <p className="mt-1 text-2xl font-semibold tabular">${fairValue.suggestedBuyPrice.toFixed(2)}</p>
        <p className="mt-1 text-xs text-ink-muted">合理中間值 × 75%，低於此價買入安全邊際充足</p>
      </div>

      {fairValue.marketPrice > 0 && (
        <p className="mt-3 text-center text-xs text-ink-muted">
          以隱含現價 ${fairValue.marketPrice.toFixed(2)}（P/E × EPS 推算）為基準
        </p>
      )}
    </Card>
  )
}

// ── 買點訊號 ──

const SIGNAL_SUBTITLE: Record<string, string> = {
  peg: 'PEG < 1.5 = 成長速度跟得上股價，不算貴',
  week52: '在今年最低點附近 = 相對便宜的時間點',
  ma200: '低於 200 日平均成本線 = 長期持有者開始虧損',
  analyst: '機構預測 12 個月後的目標股價',
  dividend: '持有期間每年領回的現金股利比率',
}

const SIGNAL_VERDICT: Record<BuySignalResult['verdict'], { label: string; tone: Tone }> = {
  STRONG_BUY: { label: '強力進場訊號', tone: 'good' },
  CONSIDER: { label: '可分批布局', tone: 'accent' },
  WAIT: { label: '訊號不足，繼續觀察', tone: 'warning' },
  AVOID: { label: '目前不建議進場', tone: 'critical' },
}

function TierRow({ tiers }: { tiers: { label: string; price: number; note: string; active?: boolean }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiers.map((tier) => (
        <div
          key={tier.label}
          className={cn('rounded-lg border p-2.5 text-center', tier.active ? 'border-accent/30 bg-accent-wash' : 'border-line')}
        >
          <p className="text-xs text-ink-muted">{tier.label}</p>
          <p className="text-sm font-semibold tabular">${tier.price.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{tier.note}</p>
        </div>
      ))}
    </div>
  )
}

function ActionPlan({ verdict, impliedPrice, untriggered }: {
  verdict: BuySignalResult['verdict']
  impliedPrice: number
  untriggered: BuySignal[]
}) {
  const t2 = impliedPrice * 0.95
  const t3 = impliedPrice * 0.9

  if (verdict === 'STRONG_BUY' || verdict === 'CONSIDER') {
    const first = verdict === 'STRONG_BUY' ? '直接市價下單' : '先買 1/3 試水'
    return (
      <div className="mt-4 space-y-3 border-t border-line pt-4">
        <p className="text-sm font-medium">建議進場方式</p>
        <TierRow
          tiers={[
            { label: '第一批（現在）', price: impliedPrice, note: first, active: true },
            { label: '第二批（等待）', price: t2, note: '跌 5% 加碼' },
            { label: '第三批（等待）', price: t3, note: '跌 10% 加碼' },
          ]}
        />
      </div>
    )
  }

  if (verdict === 'WAIT' && untriggered.length > 0) {
    return (
      <div className="mt-4 space-y-2 border-t border-line pt-4">
        <p className="text-sm font-medium">等待以下條件改善再考慮進場</p>
        {untriggered.map((s) => (
          <div key={s.id} className="flex items-start gap-2 rounded-lg border border-line px-3 py-2">
            <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
            <div>
              <span className="text-xs font-medium">{s.name}</span>
              <p className="mt-0.5 text-xs text-ink-muted">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-sm font-medium">目前不建議進場</p>
      <p className="mt-1 text-xs text-ink-muted">
        多數買點訊號尚未觸發，建議持續追蹤，等市場回調或基本面改善後再評估。
      </p>
    </div>
  )
}

function BuySignalSection({ signals }: { signals: BuySignalResult }) {
  const verdict = SIGNAL_VERDICT[signals.verdict]

  return (
    <Card className={cn('border p-5', TONE_BG[verdict.tone])}>
      <div className="flex items-center gap-2">
        <Zap className={cn('h-4 w-4', TONE_TEXT[verdict.tone])} aria-hidden />
        <h3 className="text-sm font-semibold">買點訊號評估</h3>
        <span className="ml-auto text-xs text-ink-muted">基於 P/E × EPS 隱含現價</span>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
        <span className={cn('font-medium', TONE_TEXT[verdict.tone])}>{verdict.label}</span>
        <span className="text-sm tabular text-ink-secondary">
          {signals.triggeredCount}/{signals.signals.length} 訊號觸發
        </span>
      </div>

      <p className="mt-3 text-sm text-ink-secondary">{signals.verdictText}</p>

      {signals.signals.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {signals.signals.map((sig) => (
            <li key={sig.id} className="flex items-start gap-3 rounded-lg border border-line p-3">
              {sig.triggered
                ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden />
                : <Minus className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium">{sig.name}</span>
                    {SIGNAL_SUBTITLE[sig.id] && (
                      <p className="mt-0.5 text-xs text-ink-muted">{SIGNAL_SUBTITLE[sig.id]}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular text-ink-secondary">{sig.value}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{sig.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 py-4 text-center text-sm text-ink-muted">
          資料不足以計算買點訊號（需要 PEG、52 週高低、200 日均線等）
        </p>
      )}

      {signals.impliedPrice > 0 && (
        <ActionPlan
          verdict={signals.verdict}
          impliedPrice={signals.impliedPrice}
          untriggered={signals.signals.filter((s) => !s.triggered)}
        />
      )}
    </Card>
  )
}

// ── 主頁面 ──

type Mode = 'api' | 'manual'
const EXAMPLE_SYMBOLS = ['AAPL', 'COST', 'BRK.B', 'V', 'MSFT', 'KO']

export function BuffettPage() {
  const [mode, setMode] = useState<Mode>('api')
  const [symbol, setSymbol] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BuffettAnalysis | null>(null)
  const [buySignals, setBuySignals] = useState<BuySignalResult | null>(null)
  const [fairValue, setFairValue] = useState<FairValueResult | null>(null)

  const runAnalysis = (ov: CompanyOverview) => {
    const impliedPrice = ov.peRatio > 0 && ov.eps > 0 ? ov.peRatio * ov.eps : 0
    setResult(analyzeBuffett(ov))
    setBuySignals(calcBuySignals(ov))
    setFairValue(calcFairValue(ov, impliedPrice))
  }

  const resetResults = () => {
    setError(null)
    setResult(null)
    setBuySignals(null)
    setFairValue(null)
  }

  const handleApiAnalyze = async (sym?: string) => {
    const target = (sym ?? symbol).trim().toUpperCase()
    if (!target) return

    setIsLoading(true)
    resetResults()
    try {
      runAnalysis(await stockAPIService.getCompanyOverview(target))
    } catch (err) {
      setError(err instanceof Error ? err.message : '獲取數據失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    resetResults()
  }

  const passingCount = result?.criteria.filter((c) => c.pass).length ?? 0

  return (
    <div>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-accent-wash p-2">
              <Shield className="h-5 w-5 text-accent" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold">個股研究</h1>
              <p className="text-sm text-ink-muted">ROE、護城河、低負債、合理估值 — 找出合理進場價</p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button variant={mode === 'api' ? 'primary' : 'secondary'} size="sm" onClick={() => switchMode('api')}>
              <Wifi className="h-4 w-4" aria-hidden />
              API 自動查詢
            </Button>
            <Button variant={mode === 'manual' ? 'primary' : 'secondary'} size="sm" onClick={() => switchMode('manual')}>
              <PencilLine className="h-4 w-4" aria-hidden />
              手動輸入數據
            </Button>
          </div>

          {mode === 'api' && (
            <div className="mt-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                  <input
                    type="text"
                    placeholder="輸入股票代碼，例如 AAPL"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleApiAnalyze() }}
                    className="w-full rounded-lg border border-line-strong bg-surface py-2.5 pl-9 pr-4 text-sm placeholder:text-ink-muted focus:border-accent focus:outline-none"
                  />
                </div>
                <Button onClick={() => handleApiAnalyze()} isLoading={isLoading} disabled={!symbol.trim()}>
                  分析
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-muted">巴菲特持股範例：</span>
                {EXAMPLE_SYMBOLS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSymbol(s); void handleApiAnalyze(s) }}
                    className="rounded-md bg-surface-sunken px-2 py-1 text-xs text-ink-secondary transition-colors hover:bg-line"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'manual' && <ManualInputForm onAnalyze={(ov) => { resetResults(); runAnalysis(ov) }} />}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {error && (
          <Card className="border-critical/30 bg-critical/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-critical" aria-hidden />
              <div>
                <p className="font-medium text-critical">無法分析</p>
                {error.split('\n').map((line, i) => (
                  <p key={i} className="mt-1 text-sm text-ink-secondary">{line}</p>
                ))}
                {!error.includes('ETF') && (
                  <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => switchMode('manual')}>
                    <PencilLine className="h-3.5 w-3.5" aria-hidden />
                    改用手動輸入（不需 API）
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {result && !isLoading && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xl font-semibold">
                    {result.symbol}
                    <span className="ml-2 text-base font-normal text-ink-muted">{result.name}</span>
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={RECOMMENDATION_LABEL[result.recommendation].tone === 'critical' ? 'critical' : RECOMMENDATION_LABEL[result.recommendation].tone === 'good' ? 'good' : 'accent'}>
                      {RECOMMENDATION_LABEL[result.recommendation].label}
                    </Badge>
                    <Badge>{MOAT_LABEL[result.moatStrength]}</Badge>
                    {mode === 'manual' && <Badge tone="warning">手動輸入</Badge>}
                  </div>
                </div>
                <div className="text-center">
                  <span className={cn('inline-block rounded-xl border-2 px-5 py-1.5 text-4xl font-semibold', TONE_BG[GRADE_TONE[result.grade]], TONE_TEXT[GRADE_TONE[result.grade]])}>
                    {result.grade}
                  </span>
                  <p className="mt-1 text-xs text-ink-muted">巴菲特評級</p>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">綜合評分</span>
                  <span className="font-semibold tabular">{result.totalScore} / 100</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                  {(() => {
                    const barColor: Record<Tone, string> = { good: 'bg-good', accent: 'bg-accent', warning: 'bg-warning', critical: 'bg-critical' }
                    return <div className={cn('h-full rounded-full', barColor[scoreTone(result.totalScore)])} style={{ width: `${result.totalScore}%` }} />
                  })()}
                </div>
              </div>

              <p className="mt-4 flex items-center gap-2 text-sm text-ink-secondary">
                <TrendingUp className="h-4 w-4 text-ink-muted" aria-hidden />
                通過 <strong className="font-semibold text-ink">{passingCount}/{result.criteria.length}</strong> 項巴菲特標準
              </p>

              <p className="mt-3 rounded-lg bg-surface-sunken p-3 text-sm text-ink-secondary">{result.summary}</p>
            </Card>

            {fairValue && <FairValueSection fairValue={fairValue} />}
            {buySignals && <BuySignalSection signals={buySignals} />}

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-ink-muted" aria-hidden />
                <h3 className="text-sm font-semibold">指標詳情</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.criteria.map((c) => (
                  <CriterionCard key={c.name} criterion={c} />
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-ink-muted">
              本分析僅供參考，不構成投資建議。請自行研究並承擔投資風險。
            </p>
          </div>
        )}

        {!result && !isLoading && !error && (
          <EmptyState
            Icon={Shield}
            title={mode === 'api' ? '輸入股票代碼開始分析' : '填入財務數據開始分析'}
            description={
              mode === 'api'
                ? '從 Alpha Vantage 自動抓取基本面（免費版每日 25 次）。API 不可用時可切換到手動輸入。'
                : '從 Yahoo Finance 查詢並填入指標，系統會算出巴菲特評分、合理買點與進場建議，完全不依賴 API。'
            }
          />
        )}
      </main>
    </div>
  )
}

export default BuffettPage
