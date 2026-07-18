import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTheme } from '@/stores/themeStore'
import './index.css'

// 在 React 掛載前套用主題，避免深色模式使用者看到一閃的白畫面
initTheme()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('找不到 #root 元素，請確認 index.html')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
