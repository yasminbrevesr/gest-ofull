import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Theme } from '@/lib/types'
import { profileQueryKey, useAuth, useProfile } from './auth'

const STORAGE_KEY = 'gdf-theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // navegador sem armazenamento local: o tema vale só nesta aba
  }
}

/** Tema escuro por padrão; a escolha fica salva no navegador e no perfil do usuário. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: profile } = useProfile()
  const [theme, setTheme] = useState<Theme>(readStoredTheme)
  const [profileTheme, setProfileTheme] = useState<Theme | undefined>(undefined)

  // Ao entrar, vale o tema salvo no perfil (o mesmo em qualquer aparelho).
  if (profile?.theme && profile.theme !== profileTheme) {
    setProfileTheme(profile.theme)
    setTheme(profile.theme)
  }

  useEffect(() => applyTheme(theme), [theme])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (user) {
      supabase
        .from('profiles')
        .update({ theme: next })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.warn('Não foi possível salvar o tema no perfil', error.message)
          else queryClient.setQueryData<Profile>(profileQueryKey(user.id), (old) => (old ? { ...old, theme: next } : old))
        })
    }
  }, [theme, user, queryClient])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])
  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme() {
  const ctx = use(ThemeContext)
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>')
  return ctx
}
