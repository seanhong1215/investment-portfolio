/**
 * CSS 類名工具函數
 *
 * 使用 clsx 和硬編碼類名組織 Tailwind CSS 樣式
 * 這個文件替代了原本在 CSS 中定義的 @layer components
 */

import clsx, { type ClassValue } from 'clsx'

/**
 * 卡片樣式
 * 用於展示信息的容器
 */
export const cardClass = 'bg-white rounded-lg shadow-md p-6 border border-slate-200'

/**
 * 按鈕基礎樣式工廠函數
 * @param variant 按鈕變體
 * @returns CSS 類名字符串
 */
export function getButtonClass(
  variant: 'primary' | 'secondary' | 'danger' | 'success' = 'primary'
): string {
  const baseClass = 'px-4 py-2 rounded-md font-medium transition-all duration-200'

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800',
  }

  return clsx(baseClass, variants[variant])
}

/**
 * 組合多個類名的實用函數
 * @param classes 類名數組或字符串
 * @returns 組合後的類名
 */
export function cn(...classes: ClassValue[]): string {
  return clsx(classes)
}

/**
 * 投資相關的文本顏色
 */
export const TEXT_BULL = 'text-green-600 font-semibold'  // 上漲 - 綠色
export const TEXT_BEAR = 'text-red-600 font-semibold'    // 下跌 - 紅色

/**
 * 投資相關的背景顏色
 */
export const BG_BULL = 'bg-green-100'   // 上漲背景
export const BG_BEAR = 'bg-red-100'     // 下跌背景

/**
 * 常用類組合
 */
export const CARD_BUTTON_CLASS = cn(cardClass, 'cursor-pointer hover:shadow-lg hover:scale-105 transition transform')
export const DISABLED_BUTTON_CLASS = 'opacity-50 cursor-not-allowed'
export const SPINNER_CLASS = 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'
