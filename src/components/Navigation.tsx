import { BarChart2, Heart, Target, TrendingUp, Cloud, HardDrive, AlertTriangle, Shield, Wand2 } from 'lucide-react'
import { useStorageStatusStore } from '@/stores/storageStatusStore'

export type Page = 'portfolios' | 'watchlist' | 'goals' | 'buffett' | 'builder'

interface NavigationProps {
  currentPage: Page
  onPageChange: (page: Page) => void
}

const tabs: { id: Page; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'builder',    label: '建立組合',   Icon: Wand2 },
  { id: 'portfolios', label: '投資組合',   Icon: BarChart2 },
  { id: 'watchlist',  label: '觀察清單',   Icon: Heart },
  { id: 'goals',      label: '投資目標',   Icon: Target },
  { id: 'buffett',    label: '巴菲特選股', Icon: Shield },
]

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  const { backend, error } = useStorageStatusStore()

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="text-base font-bold text-slate-900">投資組合顧問</span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 flex-1">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => onPageChange(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* 同步狀態徽章 */}
          {backend === 'pending' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-full">
              <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              <span>連接中</span>
            </div>
          )}

          {backend === 'firestore' && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-full">
              <Cloud className="w-3.5 h-3.5" />
              <span className="font-medium">雲端同步</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          )}

          {backend === 'indexeddb' && !error && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-full">
              <HardDrive className="w-3.5 h-3.5" />
              <span>本地存儲</span>
            </div>
          )}

          {backend === 'indexeddb' && error && (
            <div
              className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-1.5 rounded-full cursor-help"
              title={error}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-medium">雲端連線失敗</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navigation
