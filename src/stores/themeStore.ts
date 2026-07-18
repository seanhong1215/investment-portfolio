import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

/**
 * 把選擇寫進 <html data-theme>，CSS 那層的 :root[data-theme="dark"]
 * 會覆蓋掉作業系統的偏好設定；選 system 時移除屬性，交還給
 * prefers-color-scheme 決定。
 */
function apply(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

function readStored(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: readStored(),
  setTheme: (theme) => {
    apply(theme)
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme)
    set({ theme })
  },
}))

/**
 * 在 React 掛載前就套用主題，避免深色模式使用者先看到一閃的白畫面。
 * 由 main.tsx 於 render 之前呼叫。
 */
export function initTheme() {
  apply(readStored())
}
