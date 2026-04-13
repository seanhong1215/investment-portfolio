/**
 * 推薦配置服務
 *
 * 提供預設的投資組合推薦
 * 包含不同風險等級的配置
 */

import { RecommendedConfiguration } from '@/types'

/**
 * 推薦配置列表
 * 這些是針對不同投資者風格的預設配置
 */
export const recommendedConfigurations: RecommendedConfiguration[] = [
  {
    // ===== 保守配置（適合接近退休或風險厭惡者）=====
    id: 'conservative',
    name: '保守派 🛡️',
    description: '低風險投資組合，適合接近退休或風險厭惡的投資者',
    riskLevel: 'CONSERVATIVE',
    items: [
      // ETF：美國股市追蹤 ETF
      { symbol: 'VOO', percentage: 40, type: 'ETF' },      // Vanguard S&P 500（美國股市）
      { symbol: 'BND', percentage: 30, type: 'ETF' },      // Vanguard 全債務市場（債券）
      { symbol: 'VXUS', percentage: 15, type: 'ETF' },     // Vanguard 國際股票（國際股市）
      { symbol: 'VNQ', percentage: 10, type: 'ETF' },      // Vanguard 房地產（REITs）
      { symbol: 'VGSH', percentage: 5, type: 'ETF' },      // Vanguard 短期政府債券
    ],
  },

  {
    // ===== 平衡配置（適合大多數上班族）=====
    id: 'balanced',
    name: '平衡派 ⚖️',
    description: '中等風險投資組合，適合長期投資的上班族',
    riskLevel: 'BALANCED',
    items: [
      // ETF：70%
      { symbol: 'VOO', percentage: 40, type: 'ETF' },      // Vanguard S&P 500
      { symbol: 'VXUS', percentage: 20, type: 'ETF' },     // 國際股票
      { symbol: 'BND', percentage: 10, type: 'ETF' },      // 全債務市場

      // 個股：30%（分散風險的藍籌股和成長股）
      { symbol: 'MSFT', percentage: 8, type: 'STOCK' },    // 微軟
      { symbol: 'AAPL', percentage: 7, type: 'STOCK' },    // 蘋果
      { symbol: 'GOOGL', percentage: 7, type: 'STOCK' },   // Google
      { symbol: 'JPM', percentage: 4, type: 'STOCK' },     // JP Morgan（金融）
      { symbol: 'JNJ', percentage: 4, type: 'STOCK' },     // Johnson & Johnson（醫療）
    ],
  },

  {
    // ===== 積極配置（適合年輕投資者）=====
    id: 'aggressive',
    name: '積極派 🚀',
    description: '高風險高收益投資組合，適合年輕且有高風險承受能力的投資者',
    riskLevel: 'AGGRESSIVE',
    items: [
      // ETF：50%
      { symbol: 'VOO', percentage: 30, type: 'ETF' },      // 美國股市
      { symbol: 'VXUS', percentage: 15, type: 'ETF' },     // 國際股票
      { symbol: 'QQQ', percentage: 5, type: 'ETF' },       // Nasdaq 100（科技重）

      // 個股：50%（成長股和科技股）
      { symbol: 'NVDA', percentage: 12, type: 'STOCK' },   // Nvidia（AI/芯片）
      { symbol: 'TSLA', percentage: 10, type: 'STOCK' },   // Tesla
      { symbol: 'META', percentage: 10, type: 'STOCK' },   // Meta（Facebook）
      { symbol: 'MSFT', percentage: 8, type: 'STOCK' },    // 微軟
      { symbol: 'AAPL', percentage: 7, type: 'STOCK' },    // 蘋果
      { symbol: 'GOOGL', percentage: 7, type: 'STOCK' },   // Google
    ],
  },

  {
    // ===== 股息構建（適合追求被動收入者）=====
    id: 'dividend-focused',
    name: '股息派 💰',
    description: '專注于高股息股票和 ETF，適合追求被動收入的投資者',
    riskLevel: 'CONSERVATIVE',
    items: [
      // 高股息 ETF
      { symbol: 'VYM', percentage: 35, type: 'ETF' },      // Vanguard 高股息收益率 ETF
      { symbol: 'SCHD', percentage: 20, type: 'ETF' },     // Schwab US Dividend ETF
      { symbol: 'XLE', percentage: 10, type: 'ETF' },      // 能源 ETF

      // 高股息個股
      { symbol: 'KO', percentage: 10, type: 'STOCK' },     // Coca-Cola
      { symbol: 'PG', percentage: 8, type: 'STOCK' },      // Procter & Gamble
      { symbol: 'MMM', percentage: 7, type: 'STOCK' },     // 3M
      { symbol: 'JNJ', percentage: 7, type: 'STOCK' },     // Johnson & Johnson
      { symbol: 'MO', percentage: 3, type: 'STOCK' },      // Altria（煙草 - 高股息但有爭議）
    ],
  },

  {
    // ===== 科技成長（適合看好科技趨勢者）=====
    id: 'tech-growth',
    name: '科技派 💻',
    description: '強調科技和創新的投資組合',
    riskLevel: 'AGGRESSIVE',
    items: [
      // 科技 ETF
      { symbol: 'QQQ', percentage: 35, type: 'ETF' },      // Nasdaq 100
      { symbol: 'XLK', percentage: 15, type: 'ETF' },      // 科技行業 ETF
      { symbol: 'ARKK', percentage: 10, type: 'ETF' },     // ARK Innovation ETF

      // 科技個股
      { symbol: 'NVDA', percentage: 12, type: 'STOCK' },   // Nvidia
      { symbol: 'MSFT', percentage: 10, type: 'STOCK' },   // 微軟
      { symbol: 'AAPL', percentage: 8, type: 'STOCK' },    // 蘋果
      { symbol: 'GOOGL', percentage: 8, type: 'STOCK' },   // Google
      { symbol: 'META', percentage: 2, type: 'STOCK' },    // Meta
    ],
  },
]

/**
 * 獲取推薦配置
 * @param configId 配置 ID
 * @returns 推薦配置或 undefined
 */
export function getRecommendedConfiguration(
  configId: string
): RecommendedConfiguration | undefined {
  return recommendedConfigurations.find((config) => config.id === configId)
}

/**
 * 獲取所有推薦配置
 * @returns 所有推薦配置列表
 */
export function getAllRecommendedConfigurations(): RecommendedConfiguration[] {
  return recommendedConfigurations
}

/**
 * 獲取特定風險等級的配置
 * @param riskLevel 風險等級
 * @returns 符合風險等級的配置列表
 */
export function getConfigurationsByRiskLevel(
  riskLevel: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'
) {
  return recommendedConfigurations.filter((config) => config.riskLevel === riskLevel)
}
