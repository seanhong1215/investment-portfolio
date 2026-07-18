/**
 * 格式化工具 — 集中管理，避免各元件各寫一套 toLocaleString 參數
 * 導致同一個數字在不同頁面顯示成不同樣子。
 */

/** 金額：$12,345（預設不顯示小數，金額大時小數只是雜訊） */
export function formatCurrency(value: number, fractionDigits = 0): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/** 緊湊金額：$1.2M、$45.6K — 給軸標籤與空間有限處用 */
export function formatCompactCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

/** 百分比：12.34% */
export function formatPercent(value: number, fractionDigits = 2): string {
  return `${value.toFixed(fractionDigits)}%`
}

/** 帶正負號的百分比：+12.34% / -5.00% — 用於漲跌，正號必須明確顯示 */
export function formatSignedPercent(value: number, fractionDigits = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(fractionDigits)}%`
}

/** 帶正負號的金額：+$1,234 / -$567 */
export function formatSignedCurrency(value: number, fractionDigits = 0): string {
  return `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value), fractionDigits)}`
}

/** 日期：2026/07/17 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
