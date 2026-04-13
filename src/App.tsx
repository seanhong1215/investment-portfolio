import { useState, useEffect } from 'react'
import { usePortfolio } from '@/hooks/usePortfolio'
import Navigation, { Page } from '@/components/Navigation'
import { useStorageStatusStore } from '@/stores/storageStatusStore'
import HomePage from '@/pages/HomePage'
import WatchlistPage from '@/pages/WatchlistPage'
import GoalsPage from '@/pages/GoalsPage'
import BuffettPage from '@/pages/BuffettPage'
import PortfolioBuilderPage from '@/pages/PortfolioBuilderPage'
import './App.css'

/** 將 Firebase 錯誤碼對應到中文說明 */
function getFirebaseErrorHint(errorMsg: string): string {
  if (errorMsg.includes('auth/configuration-not-found'))
    return '請至 Firebase Console → Authentication → Sign-in method，啟用「匿名」登入方式'
  if (errorMsg.includes('auth/network-request-failed'))
    return '網路連線失敗，請確認網路狀態或稍後再試'
  if (errorMsg.includes('permission-denied'))
    return '請確認 Firestore 安全規則已正確設定'
  return errorMsg
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('portfolios')
  const [dismissedError, setDismissedError] = useState(false)
  const { isLoading, error } = usePortfolio()
  const { error: storageError } = useStorageStatusStore()

  useEffect(() => {
    console.log('🚀 應用已啟動')
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md border border-slate-200">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">出錯了</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            重新載入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />

      {/* Firebase 錯誤提示橫幅 */}
      {storageError && !dismissedError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
            <div className="text-sm text-amber-800">
              <span className="font-semibold">⚠️ 雲端同步連線失敗，目前使用本地存儲。</span>
              <span className="ml-2 text-amber-700">
                {getFirebaseErrorHint(storageError)}
              </span>
            </div>
            <button
              onClick={() => setDismissedError(true)}
              className="text-amber-500 hover:text-amber-700 text-lg leading-none shrink-0"
              aria-label="關閉"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {currentPage === 'builder'    && <PortfolioBuilderPage />}
      {currentPage === 'portfolios' && <HomePage />}
      {currentPage === 'watchlist'  && <WatchlistPage />}
      {currentPage === 'goals'      && <GoalsPage />}
      {currentPage === 'buffett'    && <BuffettPage />}
    </div>
  )
}

export default App
