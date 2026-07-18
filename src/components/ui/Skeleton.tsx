import { cn } from '@/utils/cn'

/** 載入佔位。用骨架而非轉圈，版面不會在資料到位時跳動。 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-sunken', className)}
      aria-hidden
      {...props}
    />
  )
}
