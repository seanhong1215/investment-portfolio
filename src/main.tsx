/**
 * React 應用入口點
 *
 * 這是應用啟動的起點
 * 在這裡初始化 React 根組件和全局配置
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * 應用初始化
 *
 * 步驟：
 * 1. 獲取 DOM 中的根元素（<div id="root"></div>）
 * 2. 創建 React 根組件
 * 3. 渲染 App 組件
 */

// 獲取根 DOM 元素
const rootElement = document.getElementById('root')

// 確保根元素存在
if (!rootElement) {
  throw new Error('Root element not found! Make sure to add <div id="root"></div> to index.html')
}

// 創建 React 根
const root = ReactDOM.createRoot(rootElement)

// 渲染應用
root.render(
  // React 18 的嚴格模式
  // 在開發中運行雙重渲染以幫助檢測副作用
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
