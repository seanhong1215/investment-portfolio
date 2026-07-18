import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  Icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** 空狀態。原本各頁用不同的 emoji 與文案各寫一份，收斂成單一元件。 */
export function EmptyState({ Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 py-14 text-center',
        className
      )}
    >
      <div className="rounded-full bg-surface-sunken p-3">
        <Icon className="h-6 w-6 text-ink-muted" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
