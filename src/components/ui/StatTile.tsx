import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatSignedPercent } from '@/utils/format'

interface StatTileProps {
  label: string
  value: string
  /** 變動百分比。undefined = 這個指標沒有變動概念（例如「持倉檔數」） */
  deltaPercent?: number
  /** 變動的補充說明，例如絕對金額 */
  deltaLabel?: string
  /** 版面主角用 hero：字級放大到 48px */
  emphasis?: 'default' | 'hero'
  className?: string
}

/**
 * 指標卡：數值 + 變動。
 *
 * 漲跌同時用「箭頭方向」與「顏色」兩個通道編碼 —
 * 只靠紅綠的話，紅綠色盲讀者（男性約 8%）完全讀不出漲跌，
 * 而這正好是金融介面最不能讀錯的一個數字。
 */
export function StatTile({
  label,
  value,
  deltaPercent,
  deltaLabel,
  emphasis = 'default',
  className,
}: StatTileProps) {
  const hasDelta = deltaPercent !== undefined
  const direction = !hasDelta ? 'flat' : deltaPercent > 0 ? 'up' : deltaPercent < 0 ? 'down' : 'flat'

  const DeltaIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus
  const deltaColor =
    direction === 'up' ? 'text-bull' : direction === 'down' ? 'text-bear' : 'text-ink-muted'

  return (
    <div className={cn('rounded-xl border border-line bg-surface p-5', className)}>
      <p className="text-sm text-ink-muted">{label}</p>

      <p
        className={cn(
          'mt-2 font-semibold tracking-tight text-ink',
          emphasis === 'hero' ? 'text-5xl' : 'text-3xl'
        )}
      >
        {value}
      </p>

      {hasDelta && (
        <div className={cn('mt-2 flex items-center gap-1 text-sm font-medium', deltaColor)}>
          <DeltaIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="tabular">{formatSignedPercent(deltaPercent)}</span>
          {deltaLabel && <span className="text-ink-muted font-normal">{deltaLabel}</span>}
        </div>
      )}
    </div>
  )
}
