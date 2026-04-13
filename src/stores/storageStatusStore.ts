import { create } from 'zustand'

export type StorageBackend = 'pending' | 'firestore' | 'indexeddb'

interface StorageStatusStore {
  backend: StorageBackend
  error: string | null
  setStatus: (backend: StorageBackend, error?: string | null) => void
}

export const useStorageStatusStore = create<StorageStatusStore>((set) => ({
  backend: 'pending',
  error: null,
  setStatus: (backend, error = null) => set({ backend, error }),
}))
