import { create } from 'zustand'
import { InvestmentGoal } from '@/types'

interface GoalsStore {
  goals: InvestmentGoal[]
  isLoading: boolean
  error: string | null
  setGoals: (goals: InvestmentGoal[]) => void
  addGoal: (goal: InvestmentGoal) => void
  updateGoal: (id: string, updates: Partial<InvestmentGoal>) => void
  removeGoal: (id: string) => void
  setIsLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
}

export const useGoalsStore = create<GoalsStore>((set) => ({
  goals: [],
  isLoading: false,
  error: null,

  setGoals: (goals) => set({ goals }),

  addGoal: (goal) =>
    set((state) => ({ goals: [...state.goals, goal] })),

  updateGoal: (id, updates) =>
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === id ? { ...g, ...updates, lastModified: Date.now() } : g
      ),
    })),

  removeGoal: (id) =>
    set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),

  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))
