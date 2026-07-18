import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import Navigation, { type Page } from '@/components/Navigation'
import { Button } from '@/components/ui'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useStorageStatusStore } from '@/stores/storageStatusStore'
import HomePage from '@/pages/HomePage'
import BuffettPage from '@/pages/BuffettPage'
import PortfolioBuilderPage from '@/pages/PortfolioBuilderPage'

/** 把 Firebase 的錯誤碼翻成使用者能實際採取行動的說明 */
function describeStorageError(message: string): string {
  if (message.includes('auth/configuration-not-found'))
    return '請至 Firebase Console → Authentication → Sign-in method，啟用「匿名」登入。'
  if (message.includes('auth/network-request-failed'))
    return '網路連線失敗，請確認網路狀態後重新整理。'
  if (message.includes('permission-denied'))
    return '請確認 Firestore 安全規則已允許使用者存取自己的資料。'
  return message
}

/** 雲端不可用時的提示。應用仍可正常使用，所以是橫幅而不是擋住畫面的錯誤頁。 */
function StorageWarningBanner() {
  const error = useStorageStatusStore((s) => s.error)
  const [dismissed, setDismissed] = useState(false)

  if (!error || dismissed) return null

  return (
    <div className="border-b border-line bg-warning/10">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink-secondary" aria-hidden />
        <p className="flex-1 text-sm text-ink-secondary">
          <span className="font-medium text-ink">雲端同步無法使用，資料改存在此裝置。</span>{' '}
          {describeStorageError(error)}
        </p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="關閉提示"
          className="shrink-0 rounded p-0.5 text-ink-muted hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('portfolios')
  const isLoading = usePortfolioStore((s) => s.isLoading)
  const error = usePortfolioStore((s) => s.error)
  const loadPortfolios = usePortfolioStore((s) => s.loadPortfolios)

  // 整個應用只在這裡載入一次。原本 App 與 HomePage 各自呼叫 usePortfolio()，
  // 導致開場打了兩次資料庫。
  useEffect(() => {
    void loadPortfolios()
  }, [loadPortfolios])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="max-w-md rounded-xl border border-line bg-surface p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-critical" aria-hidden />
          <h1 className="mt-4 text-lg font-semibold">無法載入投資組合</h1>
          <p className="mt-2 text-sm text-ink-muted">{error}</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            重新載入
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page">
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
      <StorageWarningBanner />

      {currentPage === 'builder' && <PortfolioBuilderPage />}
      {currentPage === 'portfolios' && <HomePage isLoading={isLoading} />}
      {currentPage === 'research' && <BuffettPage />}
    </div>
  )
}

export default App
