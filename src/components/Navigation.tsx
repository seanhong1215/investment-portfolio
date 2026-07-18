import { BarChart3, Cloud, HardDrive, LineChart, TrendingUp, Wand2 } from 'lucide-react'
import { useStorageStatusStore } from '@/stores/storageStatusStore'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '@/utils/cn'

export type Page = 'builder' | 'portfolios' | 'research'

const TABS = [
  { id: 'builder', label: '建立組合', Icon: Wand2 },
  { id: 'portfolios', label: '投資組合', Icon: BarChart3 },
  { id: 'research', label: '個股研究', Icon: LineChart },
] as const satisfies readonly { id: Page; label: string; Icon: unknown }[]

interface NavigationProps {
  currentPage: Page
  onPageChange: (page: Page) => void
}

/** 儲存後端狀態。雲端連線失敗時的說明由頁面上的橫幅負責，這裡只標示目前狀態。 */
function StorageBadge() {
  const backend = useStorageStatusStore((s) => s.backend)

  if (backend === 'pending') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink-muted">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-transparent" />
        連線中
      </span>
    )
  }

  const isCloud = backend === 'firestore'
  const Icon = isCloud ? Cloud : HardDrive

  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-muted" title={isCloud ? '資料已同步至雲端' : '資料儲存在此裝置'}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {isCloud ? '雲端同步' : '本地儲存'}
    </span>
  )
}

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  return (
    <nav className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" aria-hidden />
          <span className="text-sm font-semibold">投資組合分析</span>
        </div>

        <div className="flex flex-1 gap-1">
          {TABS.map(({ id, label, Icon }) => {
            const isActive = currentPage === id
            return (
              <button
                key={id}
                onClick={() => onPageChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-wash text-accent'
                    : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-4">
          <StorageBadge />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}

export default Navigation
