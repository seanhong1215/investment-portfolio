/**
 * 預設投資組合配置 — 「直接挑一個現成的」入口。
 *
 * 與 advisor.ts 的分工：
 * - presets：使用者不想回答問題，直接挑一個現成配置。
 * - advisor：使用者願意回答目標／年限／風險，產生個人化配置。
 *
 * 每個配置的比例總和必須等於 100，由 presets.test.ts 對全部配置逐一驗證。
 * 這條測試不是形式主義：原本「積極派」總和是 104%，
 * 會讓使用者被要求投入超過本金 4% 的錢，且沒有任何機制擋得下來。
 */

import type { RecommendedConfiguration } from '@/types'

export const recommendedConfigurations: RecommendedConfiguration[] = [
  {
    id: 'conservative',
    name: '保守配置',
    description: '債券與大盤 ETF 為主，波動低，適合接近用錢時點或風險承受度低的投資人',
    riskLevel: 'CONSERVATIVE',
    items: [
      { symbol: 'VOO', percentage: 40, type: 'ETF' },
      { symbol: 'BND', percentage: 30, type: 'ETF' },
      { symbol: 'VXUS', percentage: 15, type: 'ETF' },
      { symbol: 'VNQ', percentage: 10, type: 'ETF' },
      { symbol: 'VGSH', percentage: 5, type: 'ETF' },
    ],
  },

  {
    // ETF 70 / 個股 30 — 核心衛星策略
    id: 'balanced',
    name: '平衡配置',
    description: 'ETF 核心 70% 搭配藍籌個股衛星 30%，兼顧分散與超額報酬',
    riskLevel: 'BALANCED',
    items: [
      { symbol: 'VOO', percentage: 40, type: 'ETF' },
      { symbol: 'VXUS', percentage: 20, type: 'ETF' },
      { symbol: 'BND', percentage: 10, type: 'ETF' },
      { symbol: 'MSFT', percentage: 8, type: 'STOCK' },
      { symbol: 'AAPL', percentage: 7, type: 'STOCK' },
      { symbol: 'GOOGL', percentage: 7, type: 'STOCK' },
      { symbol: 'JPM', percentage: 4, type: 'STOCK' },
      { symbol: 'JNJ', percentage: 4, type: 'STOCK' },
    ],
  },

  {
    // ETF 50 / 個股 50。
    // 修正：原本 TSLA 與 META 各 10%，使總和達 104%；
    // 依「ETF 50 / 個股 50」的設計意圖各降至 8%，回到 100%。
    id: 'aggressive',
    name: '積極配置',
    description: '成長股與科技股各半，波動大，適合年限長且能承受回檔的投資人',
    riskLevel: 'AGGRESSIVE',
    items: [
      { symbol: 'VOO', percentage: 30, type: 'ETF' },
      { symbol: 'VXUS', percentage: 15, type: 'ETF' },
      { symbol: 'QQQ', percentage: 5, type: 'ETF' },
      { symbol: 'NVDA', percentage: 12, type: 'STOCK' },
      { symbol: 'TSLA', percentage: 8, type: 'STOCK' },
      { symbol: 'META', percentage: 8, type: 'STOCK' },
      { symbol: 'MSFT', percentage: 8, type: 'STOCK' },
      { symbol: 'AAPL', percentage: 7, type: 'STOCK' },
      { symbol: 'GOOGL', percentage: 7, type: 'STOCK' },
    ],
  },

  {
    id: 'dividend-focused',
    name: '股息配置',
    description: '高股息 ETF 與股息貴族個股，適合追求穩定現金流的投資人',
    riskLevel: 'CONSERVATIVE',
    items: [
      { symbol: 'VYM', percentage: 35, type: 'ETF' },
      { symbol: 'SCHD', percentage: 20, type: 'ETF' },
      { symbol: 'XLE', percentage: 10, type: 'ETF' },
      { symbol: 'KO', percentage: 10, type: 'STOCK' },
      { symbol: 'PG', percentage: 8, type: 'STOCK' },
      { symbol: 'MMM', percentage: 7, type: 'STOCK' },
      { symbol: 'JNJ', percentage: 7, type: 'STOCK' },
      { symbol: 'MO', percentage: 3, type: 'STOCK' },
    ],
  },

  {
    id: 'tech-growth',
    name: '科技配置',
    description: '集中於科技與創新標的，產業高度集中，風險與潛在報酬同時放大',
    riskLevel: 'AGGRESSIVE',
    items: [
      { symbol: 'QQQ', percentage: 35, type: 'ETF' },
      { symbol: 'XLK', percentage: 15, type: 'ETF' },
      { symbol: 'ARKK', percentage: 10, type: 'ETF' },
      { symbol: 'NVDA', percentage: 12, type: 'STOCK' },
      { symbol: 'MSFT', percentage: 10, type: 'STOCK' },
      { symbol: 'AAPL', percentage: 8, type: 'STOCK' },
      { symbol: 'GOOGL', percentage: 8, type: 'STOCK' },
      { symbol: 'META', percentage: 2, type: 'STOCK' },
    ],
  },
]

/** 取得所有預設配置 */
export function getAllRecommendedConfigurations(): RecommendedConfiguration[] {
  return recommendedConfigurations
}

/** 依 id 取得預設配置 */
export function getRecommendedConfiguration(id: string): RecommendedConfiguration | undefined {
  return recommendedConfigurations.find((config) => config.id === id)
}
