import { useId, useState } from 'react'
import { Table2, ChartBar } from 'lucide-react'
import type { AllocationSlice } from '@/domain/portfolioMetrics'
import { formatCurrency, formatPercent } from '@/utils/format'
import { foldToSlots } from './series'
import { cn } from '@/utils/cn'

interface AllocationBarProps {
  slices: AllocationSlice[]
  className?: string
}

/**
 * 配置佔比 — 水平堆疊條 + 表格對照。
 *
 * 為什麼不用圓餅圖：投資組合常有 8~9 檔持股，而圓餅在超過 6 段、
 * 或需要比較相近數值時就讀不出來（20% 和 23% 的扇形肉眼分不出）。
 * 水平堆疊條在標的名稱長、數量多時都還讀得動。
 *
 * 表格對照不是附屬功能：淺色模式下有三個色票對比低於 3:1，
 * 只靠顏色的話部分讀者無法辨識 —— 表格是那條「不靠顏色也讀得到值」的路徑。
 */
export function AllocationBar({ slices, className }: AllocationBarProps) {
  const [showTable, setShowTable] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const tableId = useId()

  const total = slices.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) return null

  const folded = foldToSlots(
    slices,
    (s) => s.symbol,
    (s) => s.value
  )

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">資產配置</h3>
        <button
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          {showTable ? <ChartBar className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
          {showTable ? '看圖表' : '看表格'}
        </button>
      </div>

      {!showTable && (
        <>
          {/* 堆疊條。段與段用 2px 表面色間隙分隔，而不是給每段描邊 —
              描邊會在深色模式產生一圈與兩側都不搭的輪廓。 */}
          <div className="flex h-8 gap-0.5 overflow-hidden rounded-md" role="img" aria-label={`資產配置：${folded.map((f) => `${f.label} ${formatPercent((f.value / total) * 100, 1)}`).join('、')}`}>
            {folded.map((slice) => {
              const percent = (slice.value / total) * 100
              // 只有段夠寬時才把標籤放進去，否則會被裁掉剩半個字
              const fitsLabel = percent >= 12

              return (
                <div
                  key={slice.key}
                  onMouseEnter={() => setHovered(slice.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(slice.key)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  title={`${slice.label}　${formatPercent(percent, 1)}　${formatCurrency(slice.value)}`}
                  className={cn(
                    'relative flex items-center justify-center transition-opacity',
                    hovered && hovered !== slice.key && 'opacity-50'
                  )}
                  style={{ width: `${percent}%`, backgroundColor: slice.color }}
                >
                  {fitsLabel && (
                    <span className="truncate px-1 text-xs font-medium text-white drop-shadow-sm">
                      {slice.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* 圖例。兩個以上系列一律顯示 —— 沒有圖例的話，
              段太窄放不下標籤的標的就完全無從辨識。 */}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {folded.map((slice) => (
              <li
                key={slice.key}
                onMouseEnter={() => setHovered(slice.key)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-opacity',
                  hovered && hovered !== slice.key && 'opacity-50'
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span className="text-ink-secondary">{slice.label}</span>
                <span className="tabular text-ink-muted">{formatPercent((slice.value / total) * 100, 1)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {showTable && (
        <div id={tableId} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th scope="col" className="pb-2 font-medium">標的</th>
                <th scope="col" className="pb-2 font-medium">類型</th>
                <th scope="col" className="pb-2 text-right font-medium">市值</th>
                <th scope="col" className="pb-2 text-right font-medium">佔比</th>
              </tr>
            </thead>
            <tbody>
              {/* 表格列出原始持股，不折成「其他」—— 折疊是圖表的色票限制，
                  表格沒有這個限制，沒理由在這裡也藏起來 */}
              {slices.map((slice) => (
                <tr key={slice.symbol} className="border-b border-line last:border-0">
                  <td className="py-2">
                    <span className="font-medium">{slice.symbol}</span>
                    <span className="ml-2 text-xs text-ink-muted">{slice.name}</span>
                  </td>
                  <td className="py-2 text-xs text-ink-muted">{slice.type}</td>
                  <td className="py-2 text-right tabular">{formatCurrency(slice.value)}</td>
                  <td className="py-2 text-right tabular">{formatPercent(slice.percent, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
