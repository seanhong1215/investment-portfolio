import { useState, useEffect, useCallback } from 'react'
import { InvestmentGoal } from '@/types'
import { storageService } from '@/services/storage'
import { useGoalsStore } from '@/stores/goalsStore'

export function useGoals() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { goals, addGoal, updateGoal, removeGoal } = useGoalsStore()

  const loadGoals = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await storageService.init()
      const data = await storageService.getAllGoals()
      useGoalsStore.setState({ goals: data })
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入目標失敗')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const saveGoal = useCallback(
    async (goal: InvestmentGoal) => {
      setIsLoading(true)
      setError(null)
      try {
        await storageService.init()
        await storageService.saveGoal(goal)
        const existing = goals.find((g) => g.id === goal.id)
        if (existing) {
          updateGoal(goal.id, goal)
        } else {
          addGoal(goal)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '儲存目標失敗')
      } finally {
        setIsLoading(false)
      }
    },
    [goals, addGoal, updateGoal]
  )

  const deleteGoal = useCallback(
    async (id: string) => {
      setIsLoading(true)
      setError(null)
      try {
        await storageService.init()
        await storageService.deleteGoal(id)
        removeGoal(id)
      } catch (err) {
        setError(err instanceof Error ? err.message : '刪除目標失敗')
      } finally {
        setIsLoading(false)
      }
    },
    [removeGoal]
  )

  useEffect(() => {
    loadGoals()
  }, [loadGoals])

  return { goals, isLoading, error, saveGoal, deleteGoal, loadGoals }
}

export default useGoals
