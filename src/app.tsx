import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { FullPageLoading } from '@/components/common/states'
import { AppLayout } from '@/components/layout/app-layout'
import { PublicOnly, RequireAuth } from '@/components/layout/guards'

const LoginPage = lazy(() => import('@/features/auth/login-page'))
const SignupPage = lazy(() => import('@/features/auth/signup-page'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/forgot-password-page'))
const ResetPasswordPage = lazy(() => import('@/features/auth/reset-password-page'))
const OnboardingPage = lazy(() => import('@/features/onboarding/onboarding-page'))
const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))
const ProfilePage = lazy(() => import('@/features/profile/profile-page'))
const CalculatorPage = lazy(() => import('@/features/calculator/calculator-page'))
const SimulationsPage = lazy(() => import('@/features/calculator/simulations-page'))
const NotFoundPage = lazy(() => import('@/features/not-found-page'))
const TermsPage = lazy(() => import('@/features/legal/legal-page').then((m) => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import('@/features/legal/legal-page').then((m) => ({ default: m.PrivacyPage })))

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<FullPageLoading />}>
        <Routes>
          <Route path="/entrar" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/cadastro" element={<PublicOnly><SignupPage /></PublicOnly>} />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route path="/boas-vindas" element={<RequireAuth allowOnboarding><OnboardingPage /></RequireAuth>} />

          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="calculadora" element={<CalculatorPage />} />
            <Route path="calculadora/simulacoes" element={<SimulationsPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
