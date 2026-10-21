import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ErrorState, FullPageLoading } from '@/components/common/states'
import { useAuth, useProfile } from '@/providers/auth'

/** Exige login. Quem ainda não fez o cadastro inicial vai para /boas-vindas. */
export function RequireAuth({ children, allowOnboarding = false }: { children: ReactNode; allowOnboarding?: boolean }) {
  const { session, loading } = useAuth()
  const profile = useProfile()
  const location = useLocation()

  if (loading) return <FullPageLoading />
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
  if (profile.isLoading) return <FullPageLoading />
  if (profile.error || !profile.data) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorState error={profile.error} title="Não foi possível carregar seu perfil" onRetry={() => profile.refetch()} />
      </div>
    )
  }
  if (!allowOnboarding && !profile.data.onboarding_completed_at) return <Navigate to="/boas-vindas" replace />
  return children
}

/** Telas de entrada: quem já está logado vai direto para o início. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <FullPageLoading />
  if (session) return <Navigate to="/" replace />
  return children
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile()
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return children
}
