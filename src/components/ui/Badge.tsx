import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-sunken text-ink-secondary',
        accent: 'bg-accent-wash text-accent',
        /* 狀態色一律搭配 icon 或文字使用，不靠顏色單獨表意 —
           淺色模式下 warning / serious 對比低於 3:1，這是刻意的取捨。 */
        good: 'bg-good/10 text-good',
        warning: 'bg-warning/15 text-ink',
        critical: 'bg-critical/10 text-critical',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
