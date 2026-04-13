/**
 * 巴菲特選股分析頁面
 *
 * 支援兩種模式：
 * 1. API 查詢 — Alpha Vantage 自動抓取（免費版每日 25 次限制）
 * 2. 手動輸入 — 用戶自行輸入數據（Yahoo Finance 等），不消耗 API 配額
 */

import { useState } from 'react'
import {
  Search, TrendingUp, Shield, AlertTriangle,
  CheckCircle, XCircle, Info, Zap,
  PencilLine, Wifi, ChevronDown, ChevronUp, DollarSign,
} from 'lucide-react'
import { cardClass, getButtonClass, SPINNER_CLASS } from '@/utils/classNames'
import { stockAPIService } from '@/services/stockAPI'
import { analyzeBuffett, calcBuySignals, calcFairValue } from '@/services/buffettAnalysis'
import {
  BuffettAnalysis, BuffettCriterion, BuySignalResult, BuySignal,
  FairValueResult, CompanyOverview,
} from '@/types'

// ===== 手動輸入：類型與轉換 =====

interface ManualFormData {
  symbol: string
  name: string
  // 巴菲特分析必填
  roe: string
  debtToEquity: string
  profitMargin: string
  peRatio: string
  earningsGrowthYOY: string
  currentRatio: string
  // 買點訊號 + 合理估值（選填）
  eps: string
  bookValue: string
  pegRatio: string
  dividendYield: string
  week52High: string
  week52Low: string
  movingAvg200: string
  analystTargetPrice: string
}

const DEFAULT_FORM: ManualFormData = {
  symbol: '', name: '',
  roe: '', debtToEquity: '', profitMargin: '', peRatio: '',
  earningsGrowthYOY: '', currentRatio: '',
  eps: '', bookValue: '', pegRatio: '', dividendYield: '',
  week52High: '', week52Low: '', movingAvg200: '', analystTargetPrice: '',
}

function formToOverview(form: ManualFormData): CompanyOverview {
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

// ===== 手動輸入元件 =====

function InputField({
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
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step="any"
        min={type === 'number' ? '0' : undefined}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function ManualInputForm({ onAnalyze }: { onAnalyze: (ov: CompanyOverview) => void }) {
  const [form, setForm] = useState<ManualFormData>(DEFAULT_FORM)
  const [showOptional, setShowOptional] = useState(false)

  const set = (key: keyof ManualFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const canSubmit =
    form.symbol.trim() !== '' &&
    parseFloat(form.roe) > 0 &&
    parseFloat(form.peRatio) > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAnalyze(formToOverview(form))
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {/* 數據來源提示 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        <p className="font-semibold mb-1">數據來源：Yahoo Finance（完全免費）</p>
        <p>搜尋股票後查各頁面：</p>
        <div className="mt-1 space-y-0.5">
          <p><strong>Summary</strong>：P/E、EPS、52週高低、200日均線、股息率</p>
          <p><strong>Statistics</strong>：ROE、D/E、利潤率、流動比率、帳面價值、PEG</p>
          <p><strong>Analysis</strong>：分析師共識目標價</p>
        </div>
      </div>

      {/* 股票基本資訊 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField label="股票代碼 *" value={form.symbol} onChange={set('symbol')} placeholder="AAPL" type="text" />
        <InputField label="公司名稱" value={form.name} onChange={set('name')} placeholder="Apple Inc." type="text" />
      </div>

      {/* 巴菲特分析必填欄位 */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          巴菲特分析必填（6 項）
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField
            label="ROE 股東權益報酬率 (%)"
            value={form.roe} onChange={set('roe')}
            placeholder="25.0" hint="Statistics → Management Effectiveness"
          />
          <InputField
            label="負債股權比 D/E (倍)"
            value={form.debtToEquity} onChange={set('debtToEquity')}
            placeholder="0.50" hint="Statistics → Balance Sheet"
          />
          <InputField
            label="淨利潤率 (%)"
            value={form.profitMargin} onChange={set('profitMargin')}
            placeholder="25.0" hint="Statistics → Income Statement"
          />
          <InputField
            label="本益比 P/E (倍)"
            value={form.peRatio} onChange={set('peRatio')}
            placeholder="28.0" hint="Summary 頁面"
          />
          <InputField
            label="季度盈利年增率 (%)"
            value={form.earningsGrowthYOY} onChange={set('earningsGrowthYOY')}
            placeholder="15.0" hint="Statistics → Growth"
          />
          <InputField
            label="流動比率 (倍)"
            value={form.currentRatio} onChange={set('currentRatio')}
            placeholder="1.50" hint="Statistics → Balance Sheet"
          />
        </div>
      </div>

      {/* 選填欄位開關 */}
      <button
        type="button"
        onClick={() => setShowOptional(!showOptional)}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition"
      >
        {showOptional ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        選填欄位（買點訊號 + 合理進場價計算）
      </button>

      {/* 選填欄位 */}
      {showOptional && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            選填（填越多，買點訊號越準確）
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField
              label="每股盈餘 EPS ($)"
              value={form.eps} onChange={set('eps')}
              placeholder="6.11" hint="Summary 頁面 / Statistics"
            />
            <InputField
              label="每股帳面價值 Book Value ($)"
              value={form.bookValue} onChange={set('bookValue')}
              placeholder="4.84" hint="Statistics → Per Share Data"
            />
            <InputField
              label="PEG 比率"
              value={form.pegRatio} onChange={set('pegRatio')}
              placeholder="1.85" hint="Statistics → Valuation Measures"
            />
            <InputField
              label="股息率 (%)"
              value={form.dividendYield} onChange={set('dividendYield')}
              placeholder="0.50" hint="Summary 頁面"
            />
            <InputField
              label="52週最高價 ($)"
              value={form.week52High} onChange={set('week52High')}
              placeholder="237.23" hint="Summary 頁面"
            />
            <InputField
              label="52週最低價 ($)"
              value={form.week52Low} onChange={set('week52Low')}
              placeholder="164.08" hint="Summary 頁面"
            />
            <InputField
              label="200日均線 ($)"
              value={form.movingAvg200} onChange={set('movingAvg200')}
              placeholder="195.40" hint="Summary 頁面"
            />
            <InputField
              label="分析師共識目標價 ($)"
              value={form.analystTargetPrice} onChange={set('analystTargetPrice')}
              placeholder="243.00" hint="Analysis 頁面"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        開始分析
      </button>
    </form>
  )
}

// ===== 合理價格估算卡片 =====

function PriceCard({
  label, price, hint, highlighted = false,
}: {
  label: string; price: number; hint: string; highlighted?: boolean
}) {
  return (
    <div className={`border rounded-xl p-3 text-center ${highlighted ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-black ${highlighted ? 'text-blue-800' : 'text-slate-900'}`}>
        ${price.toFixed(2)}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
    </div>
  )
}

function FairValueSection({ fairValue }: { fairValue: FairValueResult }) {
  if (!fairValue.canCalculate) {
    return (
      <div className={`${cardClass} border-slate-200`}>
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-900">合理價格估算</h3>
        </div>
        <p className="text-sm text-slate-500">
          需要 EPS 和每股帳面價值才能計算合理價格。手動輸入模式請在選填欄位填入這兩個欄位。
        </p>
      </div>
    )
  }

  const verdictConfig: Record<FairValueResult['verdict'], { label: string; color: string; bg: string }> = {
    UNDERVALUED: { label: '低估 — 目前可能是買點',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300' },
    FAIR:        { label: '合理估值區間',            color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-300'       },
    OVERVALUED:  { label: '略微高估，可等回調',       color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-300'   },
    EXPENSIVE:   { label: '嚴重高估，風險極高',       color: 'text-red-700',     bg: 'bg-red-50 border-red-300'         },
  }
  const cfg = verdictConfig[fairValue.verdict]

  return (
    <div className={`${cardClass} border-2 ${cfg.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className={`w-5 h-5 ${cfg.color}`} />
        <h3 className="text-lg font-semibold text-slate-900">合理價格估算</h3>
      </div>

      {/* 結論 */}
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-4 border ${cfg.bg}`}>
        <span className={`font-bold ${cfg.color}`}>{cfg.label}</span>
        <span className={`text-sm font-semibold ${cfg.color}`}>
          {fairValue.premiumDiscount >= 0 ? '+' : ''}
          {fairValue.premiumDiscount.toFixed(1)}% 溢/折價
        </span>
      </div>

      {/* 三種估值法 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {fairValue.grahamNumber !== null && fairValue.grahamNumber > 0 && (
          <PriceCard label="葛拉漢公式" price={fairValue.grahamNumber} hint="√(22.5 × EPS × 帳面值)" />
        )}
        {fairValue.pegFairValue !== null && fairValue.pegFairValue > 0 && (
          <PriceCard label="PEG=1 原則" price={fairValue.pegFairValue} hint="EPS × 盈利成長率" />
        )}
        {fairValue.conservativeValue !== null && fairValue.conservativeValue > 0 && (
          <PriceCard label="保守 P/E 法" price={fairValue.conservativeValue} hint="EPS × 15" />
        )}
        <PriceCard label="合理中間值" price={fairValue.fairValueMid} hint="三法平均" highlighted />
      </div>

      {/* 建議買入價 */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
        <p className="text-xs text-emerald-700 font-semibold mb-1">建議買入價（含 25% 安全邊際）</p>
        <p className="text-3xl font-black text-emerald-800">${fairValue.suggestedBuyPrice.toFixed(2)}</p>
        <p className="text-xs text-emerald-600 mt-1">合理中間值 × 75% — 低於此價買入，安全邊際充足</p>
      </div>

      {fairValue.marketPrice > 0 && (
        <p className="text-xs text-slate-500 mt-3 text-center">
          以隱含現價 <strong>${fairValue.marketPrice.toFixed(2)}</strong>（P/E × EPS 推算）為計算基準
        </p>
      )}
    </div>
  )
}

// ===== 原有子元件 =====

function GradeBadge({ grade }: { grade: BuffettAnalysis['grade'] }) {
  const styles: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    B: 'bg-blue-100 text-blue-800 border-blue-300',
    C: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    D: 'bg-orange-100 text-orange-800 border-orange-300',
    F: 'bg-red-100 text-red-800 border-red-300',
  }
  return (
    <span className={`text-5xl font-black border-2 rounded-xl px-5 py-2 ${styles[grade]}`}>
      {grade}
    </span>
  )
}

function RecommendationBadge({ rec }: { rec: BuffettAnalysis['recommendation'] }) {
  const config: Record<string, { label: string; style: string }> = {
    STRONG_BUY: { label: '強力買進', style: 'bg-emerald-600 text-white' },
    BUY:        { label: '可以買進', style: 'bg-blue-600 text-white' },
    HOLD:       { label: '持有觀望', style: 'bg-yellow-500 text-white' },
    AVOID:      { label: '避免投資', style: 'bg-red-600 text-white' },
  }
  const { label, style } = config[rec]
  return (
    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${style}`}>
      {label}
    </span>
  )
}

function MoatBadge({ moat }: { moat: BuffettAnalysis['moatStrength'] }) {
  const config: Record<string, { label: string; icon: string; style: string }> = {
    WIDE:   { label: '寬護城河', icon: '🏰', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    NARROW: { label: '窄護城河', icon: '🔒', style: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    NONE:   { label: '護城河不明顯', icon: '⚠️', style: 'bg-slate-50 text-slate-600 border-slate-200' },
  }
  const { label, icon, style } = config[moat]
  return (
    <span className={`text-sm px-3 py-1 rounded-full border ${style}`}>
      {icon} {label}
    </span>
  )
}

function ScoreBar({ score, weight }: { score: number; weight: number }) {
  const percent = weight > 0 ? Math.round((score / weight) * 100) : 0
  const color =
    percent >= 80 ? 'bg-emerald-500' :
    percent >= 60 ? 'bg-blue-500' :
    percent >= 40 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-14 text-right">
        {score}/{weight} 分
      </span>
    </div>
  )
}

function CriterionCard({ criterion }: { criterion: BuffettCriterion }) {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <div className={`p-4 rounded-lg border ${criterion.pass ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {criterion.pass
            ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
          }
          <span className="font-semibold text-sm text-slate-900">{criterion.name}</span>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
        <span className={`text-base font-bold ${criterion.pass ? 'text-emerald-700' : 'text-red-600'}`}>
          {criterion.displayValue}
        </span>
      </div>

      {showInfo && (
        <p className="text-xs text-slate-600 mb-2 pl-6">{criterion.description}</p>
      )}

      <div className="pl-6">
        <ScoreBar score={criterion.score} weight={criterion.weight} />
        <p className="text-xs text-slate-500 mt-1">標準：{criterion.benchmark}</p>
      </div>
    </div>
  )
}

// ===== 買點訊號儀表板 =====

const SIGNAL_SUBTITLE: Record<string, string> = {
  peg:      'PEG < 1.5 = 成長速度跟得上股價，不算貴',
  week52:   '在今年最低點附近 = 相對便宜的時間點',
  ma200:    '低於 200 日平均成本線 = 長期持有者開始虧損',
  analyst:  '高盛、摩根等機構預測 12 個月後的目標股價',
  dividend: '持有期間每年領回的現金股利比率',
}

const SIGNAL_VERDICT_CONFIG: Record<
  BuySignalResult['verdict'],
  { label: string; color: string; bg: string; dot: string }
> = {
  STRONG_BUY: { label: '強力進場訊號', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', dot: 'bg-emerald-500' },
  CONSIDER:   { label: '可分批布局',   color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-300',       dot: 'bg-blue-500'    },
  WAIT:       { label: '訊號不足，繼續觀察', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300', dot: 'bg-amber-500'  },
  AVOID:      { label: '目前不建議進場', color: 'text-red-700',   bg: 'bg-red-50 border-red-300',         dot: 'bg-red-500'    },
}

function BuySignalDashboard({ signals }: { signals: BuySignalResult }) {
  const cfg = SIGNAL_VERDICT_CONFIG[signals.verdict]
  return (
    <div className={`${cardClass} border-2 ${cfg.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Zap className={`w-5 h-5 ${cfg.color}`} />
        <h3 className="text-lg font-semibold text-slate-900">買點訊號評估</h3>
        <span className="text-xs text-slate-400 ml-1">（基於 P/E × EPS 隱含現價）</span>
      </div>

      <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-4 border ${cfg.bg}`}>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full shrink-0 ${cfg.dot}`} />
          <span className={`font-bold text-base ${cfg.color}`}>{cfg.label}</span>
        </div>
        <span className={`text-sm font-semibold ${cfg.color}`}>
          {signals.triggeredCount}/{signals.signals.length} 訊號
        </span>
      </div>

      <p className={`text-sm mb-4 font-medium ${cfg.color}`}>{signals.verdictText}</p>

      <div className="space-y-2">
        {signals.signals.map((sig) => (
          <div
            key={sig.id}
            className={`flex items-start gap-3 rounded-lg p-3 border transition-colors ${
              sig.triggered
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {sig.triggered
                ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                : <XCircle className="w-4 h-4 text-slate-300" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <span className={`text-sm font-semibold ${sig.triggered ? 'text-emerald-800' : 'text-slate-600'}`}>
                    {sig.name}
                  </span>
                  {SIGNAL_SUBTITLE[sig.id] && (
                    <p className="text-xs text-slate-400 mt-0.5">{SIGNAL_SUBTITLE[sig.id]}</p>
                  )}
                </div>
                <span className={`text-sm font-bold shrink-0 ${sig.triggered ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {sig.value}
                </span>
              </div>
              <p className={`text-xs mt-1.5 leading-relaxed ${sig.triggered ? 'text-emerald-700' : 'text-slate-500'}`}>
                {sig.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {signals.signals.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">
          資料不足以計算買點訊號（需要 PEG、52 週高低點、200 日均線等數據）
        </p>
      )}

      {signals.impliedPrice > 0 && (
        <ActionPlan
          verdict={signals.verdict}
          impliedPrice={signals.impliedPrice}
          untriggeredSignals={signals.signals.filter((s) => !s.triggered)}
        />
      )}

      {signals.impliedPrice > 0 && (
        <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-200 text-center">
          以上價格基於隱含現價 <strong>${signals.impliedPrice.toFixed(2)}</strong>（P/E × EPS 推算）
        </p>
      )}
    </div>
  )
}

function ActionPlan({
  verdict, impliedPrice, untriggeredSignals,
}: {
  verdict: BuySignalResult['verdict']
  impliedPrice: number
  untriggeredSignals: BuySignal[]
}) {
  const t2 = impliedPrice * 0.95
  const t3 = impliedPrice * 0.90

  if (verdict === 'STRONG_BUY') {
    return (
      <div className="mt-4 pt-4 border-t border-emerald-200 space-y-3">
        <p className="text-sm font-bold text-emerald-800">建議進場方式</p>
        <div className="bg-emerald-100 border border-emerald-300 rounded-xl p-3">
          <p className="text-sm font-bold text-emerald-900">訊號充足 — 現在可以直接下單</p>
          <p className="text-xs text-emerald-700 mt-1">
            建議先買入 1/3 ~ 1/2 倉位（市價約 <strong>${impliedPrice.toFixed(2)}</strong>），剩餘分批等回調加碼
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: '第一批（現在）', price: impliedPrice, note: '直接市價下單', cls: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
            { label: '第二批（等待）', price: t2,           note: '跌 5% 時加碼',  cls: 'border-slate-200 bg-white text-slate-600' },
            { label: '第三批（等待）', price: t3,           note: '跌 10% 時加碼', cls: 'border-slate-200 bg-white text-slate-600' },
          ] as const).map((tier) => (
            <div key={tier.label} className={`border rounded-xl p-2.5 text-center ${tier.cls}`}>
              <p className="text-xs mb-1 opacity-70">{tier.label}</p>
              <p className="text-sm font-black text-slate-900">${tier.price.toFixed(2)}</p>
              <p className="text-xs mt-0.5">{tier.note}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (verdict === 'CONSIDER') {
    return (
      <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
        <p className="text-sm font-bold text-blue-800">建議布局方式</p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-sm font-bold text-blue-900">先小量試水溫，等訊號齊全再加碼</p>
          <p className="text-xs text-blue-700 mt-1">
            建議先買入 1/3 倉位（約 <strong>${impliedPrice.toFixed(2)}</strong>），等更多訊號確認後再補倉
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: '第一批（現在）', price: impliedPrice, note: '先買 1/3 試水', cls: 'border-blue-200 bg-blue-50 text-blue-700' },
            { label: '第二批（等待）', price: t2,           note: '跌 5% 加碼',   cls: 'border-slate-200 bg-white text-slate-600' },
            { label: '第三批（等待）', price: t3,           note: '跌 10% 加碼',  cls: 'border-slate-200 bg-white text-slate-600' },
          ] as const).map((tier) => (
            <div key={tier.label} className={`border rounded-xl p-2.5 text-center ${tier.cls}`}>
              <p className="text-xs mb-1 opacity-70">{tier.label}</p>
              <p className="text-sm font-black text-slate-900">${tier.price.toFixed(2)}</p>
              <p className="text-xs mt-0.5">{tier.note}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (verdict === 'WAIT' && untriggeredSignals.length > 0) {
    return (
      <div className="mt-4 pt-4 border-t border-amber-200 space-y-2">
        <p className="text-sm font-bold text-amber-800">等待以下條件改善再考慮進場：</p>
        {untriggeredSignals.map((s) => (
          <div key={s.id} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-amber-800">{s.name}</span>
              <p className="text-xs text-amber-700 mt-0.5">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-red-200">
      <p className="text-sm font-bold text-red-800 mb-2">目前不建議進場</p>
      <p className="text-xs text-slate-600">
        多數買點訊號尚未觸發，建議加入觀察清單持續追蹤，等市場回調或基本面改善後再評估。
      </p>
    </div>
  )
}

// ===== 主頁面 =====

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

  // 執行分析（共用邏輯）
  const runAnalysis = (ov: CompanyOverview) => {
    const analysis = analyzeBuffett(ov)
    const signals = calcBuySignals(ov)
    const impliedPrice = ov.peRatio > 0 && ov.eps > 0 ? ov.peRatio * ov.eps : 0
    const fv = calcFairValue(ov, impliedPrice)
    setResult(analysis)
    setBuySignals(signals)
    setFairValue(fv)
  }

  // API 模式查詢
  const handleAnalyze = async (sym?: string) => {
    const target = (sym ?? symbol).trim().toUpperCase()
    if (!target) return

    setIsLoading(true)
    setError(null)
    setResult(null)
    setBuySignals(null)
    setFairValue(null)

    try {
      const ov = await stockAPIService.getCompanyOverview(target)
      runAnalysis(ov)
    } catch (err) {
      setError(err instanceof Error ? err.message : '獲取數據失敗')
    } finally {
      setIsLoading(false)
    }
  }

  // 手動輸入模式
  const handleManualAnalyze = (ov: CompanyOverview) => {
    setError(null)
    setResult(null)
    setBuySignals(null)
    setFairValue(null)
    runAnalysis(ov)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze()
  }

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode)
    setError(null)
    setResult(null)
    setBuySignals(null)
    setFairValue(null)
  }

  const passingCount = result?.criteria.filter((c) => c.pass).length ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100">
      {/* 頁面頭部 */}
      <header className="bg-white shadow-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-amber-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">巴菲特選股分析</h1>
              <p className="text-slate-600 mt-1">
                ROE、護城河、低負債、合理估值 — 找出合理進場價
              </p>
            </div>
          </div>

          {/* 模式切換 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleModeSwitch('api')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition ${
                mode === 'api'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Wifi className="w-4 h-4" />
              API 自動查詢
            </button>
            <button
              onClick={() => handleModeSwitch('manual')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition ${
                mode === 'manual'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <PencilLine className="w-4 h-4" />
              手動輸入數據
            </button>
          </div>

          {/* API 模式輸入 */}
          {mode === 'api' && (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="輸入股票代碼，例如 AAPL"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
                  />
                </div>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isLoading || !symbol.trim()}
                  className={`${getButtonClass('primary')} disabled:opacity-50 disabled:cursor-not-allowed bg-amber-600 hover:bg-amber-700 active:bg-amber-800`}
                >
                  {isLoading ? '分析中...' : '分析'}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-slate-500">巴菲特持股範例：</span>
                {EXAMPLE_SYMBOLS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSymbol(s); handleAnalyze(s) }}
                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 手動輸入模式 */}
          {mode === 'manual' && (
            <ManualInputForm onAnalyze={handleManualAnalyze} />
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* 載入中 */}
        {isLoading && (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className={SPINNER_CLASS} />
            <p className="text-slate-600">正在獲取 {symbol} 基本面數據...</p>
            <p className="text-xs text-slate-400">Alpha Vantage 免費版每日 25 次限制，請稍候</p>
          </div>
        )}

        {/* 錯誤 */}
        {error && (
          <div className={`${cardClass} border-red-200 bg-red-50 flex items-start gap-3`}>
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">無法分析</p>
              {error.split('\n').map((line, i) => (
                <p key={i} className="text-sm text-red-600 mt-1">{line}</p>
              ))}
              {!error.includes('ETF') && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-800 mb-1">💡 API 無法使用時的替代方案</p>
                  <p className="text-xs text-amber-700">
                    切換到「手動輸入數據」模式，從 Yahoo Finance 免費查詢並自行輸入各項指標，即可在不依賴 API 的情況下完成分析。
                  </p>
                  <button
                    onClick={() => handleModeSwitch('manual')}
                    className="mt-2 flex items-center gap-1 text-xs text-amber-800 font-semibold hover:underline"
                  >
                    <PencilLine className="w-3.5 h-3.5" />
                    切換到手動輸入 →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 分析結果 */}
        {result && !isLoading && (
          <div className="space-y-6">
            {/* 總覽卡片 */}
            <div className={cardClass}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {result.symbol}
                    <span className="text-lg font-normal text-slate-500 ml-2">{result.name}</span>
                  </h2>
                  {mode === 'manual' && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium mt-1 inline-block">
                      手動輸入數據
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <RecommendationBadge rec={result.recommendation} />
                    <MoatBadge moat={result.moatStrength} />
                  </div>
                </div>
                <div className="text-center">
                  <GradeBadge grade={result.grade} />
                  <p className="text-xs text-slate-500 mt-1">巴菲特評級</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm text-slate-600 mb-1">
                  <span>綜合評分</span>
                  <span className="font-bold text-slate-900">{result.totalScore} / 100</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      result.totalScore >= 75 ? 'bg-emerald-500' :
                      result.totalScore >= 60 ? 'bg-blue-500' :
                      result.totalScore >= 45 ? 'bg-yellow-500' : 'bg-red-400'
                    }`}
                    style={{ width: `${result.totalScore}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600">
                  通過 <strong className="text-slate-900">{passingCount}/{result.criteria.length}</strong> 項巴菲特標準
                </span>
              </div>

              <p className="text-sm text-slate-600 mt-3 p-3 bg-slate-50 rounded-lg">
                {result.summary}
              </p>
            </div>

            {/* 合理價格估算 */}
            {fairValue && <FairValueSection fairValue={fairValue} />}

            {/* 買點訊號儀表板 */}
            {buySignals && <BuySignalDashboard signals={buySignals} />}

            {/* 各項指標詳情 */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">指標詳情</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.criteria.map((c) => (
                  <CriterionCard key={c.name} criterion={c} />
                ))}
              </div>
            </div>

            {/* 巴菲特格言 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">巴菲特名言</p>
              {result.totalScore >= 70
                ? <p>「以合理的價格買入一家優秀的公司，遠好過以優惠的價格買入一家普通的公司。」</p>
                : result.totalScore >= 45
                ? <p>「只有當潮水退去，才知道誰在裸泳。在買入任何股票前，確保你了解它的護城河。」</p>
                : <p>「第一條規則：永遠不要虧錢。第二條規則：永遠不要忘記第一條。」</p>
              }
              <p className="mt-2 text-xs text-amber-600">
                ⚠️ 本分析僅供參考，不構成投資建議。請自行研究並承擔投資風險。
              </p>
            </div>
          </div>
        )}

        {/* 初始空狀態 */}
        {!result && !isLoading && !error && (
          <div className="text-center py-16">
            <Shield className="w-16 h-16 text-amber-300 mx-auto mb-4" />
            {mode === 'api' ? (
              <>
                <h2 className="text-xl font-semibold text-slate-700 mb-2">輸入股票代碼開始分析</h2>
                <p className="text-slate-500 max-w-md mx-auto text-sm">
                  從 Alpha Vantage 自動抓取基本面數據（免費版每日 25 次）。
                  如果 API 無法使用，可切換到「手動輸入數據」模式。
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-slate-700 mb-2">填入財務數據開始分析</h2>
                <p className="text-slate-500 max-w-md mx-auto text-sm">
                  從 Yahoo Finance 查詢並填入各項指標，系統將自動計算巴菲特評分、合理買點與進場建議。
                  完全不依賴 API，隨時可用。
                </p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default BuffettPage
