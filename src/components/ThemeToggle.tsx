import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/utils/cn'

const OPTIONS = [
  { value: 'light', label: '淺色', Icon: Sun },
  { value: 'system', label: '跟隨系統', Icon: Monitor },
  { value: 'dark', label: '深色', Icon: Moon },
] as const

/** 三段式主題切換。用 radiogroup 而非 button，讓螢幕閱讀器讀得出目前選中哪個。 */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <div role="radiogroup" aria-label="色彩主題" className="flex gap-0.5 rounded-lg bg-surface-sunken p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            theme === value
              ? 'bg-surface text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink'
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  )
}
