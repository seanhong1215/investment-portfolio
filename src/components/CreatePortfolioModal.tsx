/**
 * 建立投資組合模態框組件
 *
 * 一個完整的表單，允許用戶：
 * 1. 輸入投資組合名稱和描述
 * 2. 選擇推薦配置或自定義配置
 * 3. 設置投資目標和目標金額
 * 4. 建立投資組合並保存
 */

import { useState, useEffect } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { cardClass, getButtonClass } from '@/utils/classNames'
import { Portfolio, RecommendedConfiguration } from '@/types'
import { getAllRecommendedConfigurations } from '@/services/recommendedConfigs'

/**
 * Modal 的 Props 規範
 */
interface CreatePortfolioModalProps {
  // 是否顯示 Modal
  isOpen: boolean
  // 關閉 Modal 的事件處理器
  onClose: () => void
  // 建立投資組合的事件處理器
  onCreate: (portfolio: Portfolio) => void
}

/**
 * 表單數據接口
 */
interface FormData {
  // 投資組合名稱
  portfolioName: string
  // 投資組合描述
  description: string
  // 選擇的推薦配置 ID
  selectedConfig?: string
  // 投資目標
  investmentGoal: 'RETIREMENT' | 'HOME' | 'SAVINGS' | 'EDUCATION' | 'OTHER'
  // 目標金額
  targetAmount: number
  // 投資年限
  investmentYears: number
}

/**
 * CreatePortfolioModal 組件
 */
export function CreatePortfolioModal({
  isOpen,
  onClose,
  onCreate,
}: CreatePortfolioModalProps) {
  // ===== 狀態 =====

  // 當前步驟 (1: 基本資訊, 2: 選擇配置, 3: 確認)
  const [step, setStep] = useState(1)

  // 表單數據
  const [formData, setFormData] = useState<FormData>({
    portfolioName: '',
    description: '',
    investmentGoal: 'SAVINGS',
    targetAmount: 10000,
    investmentYears: 5,
  })

  // 推薦配置列表
  const [configs, setConfigs] = useState<RecommendedConfiguration[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ===== 效果鉤 =====

  // 當 Modal 打開時，加載推薦配置
  useEffect(() => {
    if (isOpen) {
      try {
        const allConfigs = getAllRecommendedConfigurations()
        setConfigs(allConfigs)
      } catch (err) {
        setError('加載推薦配置失敗')
      }
    }
  }, [isOpen])

  // ===== 事件處理器 =====

  /**
   * 處理表單輸入變化
   */
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    const numericValue = ['targetAmount', 'investmentYears'].includes(name)
      ? parseFloat(value) || 0
      : value

    setFormData((prev) => ({
      ...prev,
      [name]: numericValue,
    }))
  }

  /**
   * 選擇推薦配置
   */
  const handleSelectConfig = (configId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedConfig: configId,
    }))
  }

  /**
   * 提交表單並建立投資組合
   */
  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 驗證必填字段
      if (!formData.portfolioName.trim()) {
        throw new Error('請輸入投資組合名稱')
      }
      if (!formData.selectedConfig) {
        throw new Error('請選擇推薦配置')
      }
      if (formData.targetAmount <= 0) {
        throw new Error('目標金額必須大於 0')
      }

      // 找到選定的配置
      const selectedConfigData = configs.find((c) => c.id === formData.selectedConfig)
      if (!selectedConfigData) {
        throw new Error('無效的配置選擇')
      }

      // 創建投資組合對象
      const newPortfolio: Portfolio = {
        id: `portfolio_${Date.now()}`,
        name: formData.portfolioName,
        description: formData.description,
        items: [], // 初始時為空，用戶可以手動添加或從配置生成
        targetAmount: formData.targetAmount,
        totalInvested: 0,
        totalValue: 0,
        totalGain: 0,
        totalGainPercent: 0,
        investmentGoal: formData.investmentGoal,
        investmentYears: formData.investmentYears,
        createdDate: Date.now(),
        lastModified: Date.now(),
        isDefault: false,
      }

      // 調用回調函數
      onCreate(newPortfolio)

      // 重置表單和步驟
      resetForm()
      onClose()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '建立投資組合失敗'
      setError(errorMsg)
      console.error('❌', errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 重置表單
   */
  const resetForm = () => {
    setStep(1)
    setFormData({
      portfolioName: '',
      description: '',
      investmentGoal: 'SAVINGS',
      targetAmount: 10000,
      investmentYears: 5,
    })
    setError(null)
  }

  /**
   * 關閉 Modal
   */
  const handleClose = () => {
    resetForm()
    onClose()
  }

  // ===== 條件渲染 =====

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${cardClass} max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto`}>
        {/* 頭部 */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">
            📋 建立投資組合
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* 步驟指示器 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center flex-1">
            {['基本信息', '選擇配置', '確認提交'].map((label, index) => (
              <div key={label} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    step > index
                      ? 'bg-blue-600 text-white'
                      : step === index + 1
                        ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {index + 1}
                </div>
                {index < 2 && (
                  <div className={`h-1 flex-1 mx-2 ${step > index + 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
          <span className="ml-4 text-sm text-slate-600">
            步驟 {step}/3
          </span>
        </div>

        {/* 錯誤信息 */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* 內容區域 */}
        <div className="mb-6">
          {step === 1 && (
            <div className="space-y-4">
              {/* 投資組合名稱 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  投資組合名稱 *
                </label>
                <input
                  type="text"
                  name="portfolioName"
                  value={formData.portfolioName}
                  onChange={handleInputChange}
                  placeholder="例如：退休基金"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  描述（可選）
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="例如：為了35歲退休而準備"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 投資目標 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  投資目標
                </label>
                <select
                  name="investmentGoal"
                  value={formData.investmentGoal}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="RETIREMENT">🏖️ 退休</option>
                  <option value="HOME">🏠 買房</option>
                  <option value="SAVINGS">💰 儲蓄</option>
                  <option value="EDUCATION">🎓 教育</option>
                  <option value="OTHER">📌 其他</option>
                </select>
              </div>

              {/* 目標金額和投資年限 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    目標金額 (USD) *
                  </label>
                  <input
                    type="number"
                    name="targetAmount"
                    value={formData.targetAmount}
                    onChange={handleInputChange}
                    min="0"
                    step="1000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    投資年限
                  </label>
                  <input
                    type="number"
                    name="investmentYears"
                    value={formData.investmentYears}
                    onChange={handleInputChange}
                    min="1"
                    max="50"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                選擇推薦配置，系統會自動創建您的投資組合。您也可以之後手動調整。
              </p>
              {configs.map((config) => (
                <div
                  key={config.id}
                  onClick={() => handleSelectConfig(config.id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                    formData.selectedConfig === config.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {config.name}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {config.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {config.items.slice(0, 3).map((item, idx) => (
                          <span key={idx} className="text-xs bg-slate-100 px-2 py-1 rounded">
                            {item.symbol} ({item.percentage}%)
                          </span>
                        ))}
                        {config.items.length > 3 && (
                          <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                            + {config.items.length - 3} 更多
                          </span>
                        )}
                      </div>
                    </div>
                    {formData.selectedConfig === config.id && (
                      <div className="text-blue-600">✓</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 mb-4">確認投資組合信息</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">名稱：</span>
                  <span className="font-medium text-slate-900">
                    {formData.portfolioName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">目標：</span>
                  <span className="font-medium text-slate-900">
                    {formData.investmentGoal}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">目標金額：</span>
                  <span className="font-medium text-slate-900">
                    ${formData.targetAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">投資年限：</span>
                  <span className="font-medium text-slate-900">
                    {formData.investmentYears} 年
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">配置：</span>
                  <span className="font-medium text-slate-900">
                    {configs.find((c) => c.id === formData.selectedConfig)?.name || '未選擇'}
                  </span>
                </div>
              </div>
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  💡 創建後，您可以隨時:
                </p>
                <ul className="text-sm text-blue-800 mt-2 ml-4 list-disc">
                  <li>添加或移除個股</li>
                  <li>調整配置比例</li>
                  <li>設置定期定額計劃</li>
                  <li>設置加碼提醒</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-200">
          <button
            onClick={handleClose}
            className={getButtonClass('secondary')}
            disabled={isLoading}
          >
            取消
          </button>

          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className={getButtonClass('secondary')}
                disabled={isLoading}
              >
                ← 上一步
              </button>
            )}

            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                className={`${getButtonClass('primary')} inline-flex items-center gap-2`}
                disabled={
                  isLoading ||
                  (step === 1 && !formData.portfolioName.trim()) ||
                  (step === 2 && !formData.selectedConfig)
                }
              >
                下一步 <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleSubmit}
                className={getButtonClass('success')}
                disabled={isLoading}
              >
                {isLoading ? '建立中...' : '✓ 建立投資組合'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatePortfolioModal
