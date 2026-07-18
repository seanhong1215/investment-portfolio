/**
 * 投資組合指標計算 — 純函數，不碰 React、不碰 I/O。
 *
 * 這些計算原本 inline 寫在各個頁面元件裡（HomePage 直接 reduce、
 * PortfolioDetail 又算一次），造成兩個問題：
 * 1. 同一個指標在不同頁面可能算出不同結果，沒有單一事實來源。
 * 2. 要測就得先掛載整個 React 元件樹，於是實際上沒人寫測試。
 *
 * 抽成純函數後，除以零、空組合、負報酬這些邊界狀況都能直接測。
 */

import type { Portfolio, PortfolioItem } from '@/types'

/** 一組投資組合的彙總結果 */
export interface PortfolioSummary {
  totalInvested: number
  totalValue: number
  totalGain: number
  /** 報酬率 %。投入為 0 時回傳 0（而非 NaN／Infinity） */
  totalGainPercent: number
}

/** 單一標的在組合中的實際佔比 */
export interface AllocationSlice {
  symbol: string
  name: string
  type: 'ETF' | 'STOCK'
  value: number
  /** 佔組合市值的百分比 */
  percent: number
}

/** 實際配置與目標配置的偏離 */
export interface AllocationDrift {
  symbol: string
  targetPercent: number
  actualPercent: number
  /** 正 = 超配，負 = 低配 */
  driftPercent: number
  /** 偏離是否超過再平衡門檻 */
  needsRebalance: boolean
}

/**
 * 計算報酬率。
 *
 * 投入為 0 是真實會發生的狀況（剛建立、還沒下單的組合），
 * 直接相除會得到 NaN 或 Infinity 並一路渲染到畫面上變成「NaN%」。
 */
export function gainPercent(invested: number, gain: number): number {
  if (invested <= 0) return 0
  return (gain / invested) * 100
}

/** 由持倉重新計算單一組合的總額 — 不信任儲存的快取值，一律由 items 推導 */
export function calcPortfolioTotals(items: PortfolioItem[]): PortfolioSummary {
  const totalInvested = items.reduce((sum, item) => sum + item.investedAmount, 0)
  const totalValue = items.reduce((sum, item) => sum + item.currentValue, 0)
  const totalGain = totalValue - totalInvested

  return {
    totalInvested,
    totalValue,
    totalGain,
    totalGainPercent: gainPercent(totalInvested, totalGain),
  }
}

/** 彙總多個組合（首頁的總覽數字） */
export function summarizePortfolios(portfolios: Portfolio[]): PortfolioSummary {
  const totalInvested = portfolios.reduce((sum, p) => sum + p.totalInvested, 0)
  const totalValue = portfolios.reduce((sum, p) => sum + p.totalValue, 0)
  const totalGain = totalValue - totalInvested

  return {
    totalInvested,
    totalValue,
    totalGain,
    totalGainPercent: gainPercent(totalInvested, totalGain),
  }
}

/**
 * 計算各標的的實際佔比，由大到小排序。
 * 排序是必要的：圖表的類別色票依固定順序指派，
 * 若順序會跳動，同一個標的在重新整理後會換顏色。
 */
export function calcAllocation(items: PortfolioItem[]): AllocationSlice[] {
  const totalValue = items.reduce((sum, item) => sum + item.currentValue, 0)

  return items
    .map((item) => ({
      symbol: item.stock.symbol,
      name: item.stock.name,
      type: item.stock.type,
      value: item.currentValue,
      percent: totalValue <= 0 ? 0 : (item.currentValue / totalValue) * 100,
    }))
    .sort((a, b) => b.value - a.value)
}

/**
 * 計算 ETF 與個股的比重 — 本應用的核心概念（核心衛星策略的 70/30）。
 */
export function calcTypeMix(items: PortfolioItem[]): { etfPercent: number; stockPercent: number } {
  const totalValue = items.reduce((sum, item) => sum + item.currentValue, 0)
  if (totalValue <= 0) return { etfPercent: 0, stockPercent: 0 }

  const etfValue = items
    .filter((item) => item.stock.type === 'ETF')
    .reduce((sum, item) => sum + item.currentValue, 0)

  const etfPercent = (etfValue / totalValue) * 100
  return { etfPercent, stockPercent: 100 - etfPercent }
}

/**
 * 計算實際配置與目標配置的偏離，用於判斷是否需要再平衡。
 *
 * @param threshold 偏離超過幾個百分點才算需要再平衡。預設 5 —
 *   這是常見的「5/25 法則」中的絕對門檻，低於此值時交易成本通常不划算。
 */
export function calcDrift(
  items: PortfolioItem[],
  targets: { symbol: string; percentage: number }[],
  threshold = 5
): AllocationDrift[] {
  const allocation = calcAllocation(items)
  const actualBySymbol = new Map(allocation.map((slice) => [slice.symbol, slice.percent]))

  return targets.map((target) => {
    const actualPercent = actualBySymbol.get(target.symbol) ?? 0
    const driftPercent = actualPercent - target.percentage

    return {
      symbol: target.symbol,
      targetPercent: target.percentage,
      actualPercent,
      driftPercent,
      needsRebalance: Math.abs(driftPercent) >= threshold,
    }
  })
}

/**
 * 目標達成進度 %，上限 100。
 * 超額達成時顯示 100 而非 137%，因為進度條長度無法表達超過滿格的狀態；
 * 實際金額仍會在旁邊完整顯示。
 */
export function calcGoalProgress(currentValue: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0
  return Math.min((currentValue / targetAmount) * 100, 100)
}
