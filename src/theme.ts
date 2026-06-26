import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'carcassonne-companion:theme'

/** Concrete appearance for a choice, given the current OS preference. */
export function resolveTheme(
  choice: ThemeChoice,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light'
  return choice
}

/** Cycle order for the header toggle: light → dark → system → light. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return choice === 'light' ? 'dark' : choice === 'dark' ? 'system' : 'light'
}

/** Canvas background per resolved theme — must match --color-canvas in
 *  index.css and the inline pre-paint script in index.html. */
export const CANVAS_COLOR: Record<ResolvedTheme, string> = {
  dark: '#111827',
  light: '#f9fafb',
}

const DARK_MQ = '(prefers-color-scheme: dark)'

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_MQ).matches
  } catch {
    return true // dark is the historical default
  }
}

function readStoredChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // ignore
  }
  return 'system'
}

/** Apply a resolved theme to the document: class, inline canvas background
 *  (covers the moment before/independent of CSS), and the status-bar meta. */
function applyResolved(resolved: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(resolved)
  root.style.backgroundColor = CANVAS_COLOR[resolved]
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', CANVAS_COLOR[resolved])
}

interface ThemeContextValue {
  theme: ThemeChoice
  resolved: ResolvedTheme
  setTheme: (choice: ThemeChoice) => void
  cycle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => readStoredChoice())
  // Re-render when the OS preference flips while in system mode.
  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark())

  useEffect(() => {
    try {
      const mq = window.matchMedia(DARK_MQ)
      const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      return
    }
  }, [])

  const resolved = resolveTheme(theme, systemDark)

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // ignore
    }
    applyResolved(resolved)
  }, [theme, resolved])

  const value: ThemeContextValue = {
    theme,
    resolved,
    setTheme: setThemeState,
    cycle: () => setThemeState((c) => nextTheme(c)),
  }

  return createElement(ThemeContext.Provider, { value }, children)
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
