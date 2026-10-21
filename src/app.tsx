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
const JourneyPage = lazy(() => import('@/features/journey/journey-page'))
const StepPage = lazy(() => import('@/features/journey/step-page'))
const GlossaryPage = lazy(() => import('@/features/glossary/glossary-page'))
const StockPage = lazy(() => import('@/features/stock/stock-page'))
const ProductFormPage = lazy(() => import('@/features/stock/product-form-page'))
const ProductDetailPage = lazy(() => import('@/features/stock/product-detail-page'))
const ImportPage = lazy(() => import('@/features/stock/import-page'))
const MovementsPage = lazy(() => import('@/features/stock/movements-page'))
const NotFoundPage = lazy(() => import('@/features/not-found-page'))
const TermsPage = lazy(() => import('@/features/legal/legal-page').then((m) => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import('@/features/legal/legal-page').then((m) => ({ default: m.PrivacyPage })))

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<FullPageLoading />}>
        <Routes>
          <Route
            path="/entrar"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/cadastro"
            element={
              <PublicOnly>
                <SignupPage />
              </PublicOnly>
            }
          />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route
            path="/boas-vindas"
            element={
              <RequireAuth allowOnboarding>
                <OnboardingPage />
              </RequireAuth>
            }
          />

          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="jornada" element={<JourneyPage />} />
            <Route path="jornada/:slug" element={<StepPage />} />
            <Route path="calculadora" element={<CalculatorPage />} />
            <Route path="calculadora/simulacoes" element={<SimulationsPage />} />
            <Route path="estoque" element={<StockPage />} />
            <Route path="estoque/novo" element={<ProductFormPage />} />
            <Route path="estoque/importar" element={<ImportPage />} />
            <Route path="estoque/movimentacoes" element={<MovementsPage />} />
            <Route path="estoque/:id" element={<ProductDetailPage />} />
            <Route path="estoque/:id/editar" element={<ProductFormPage />} />
            <Route path="glossario" element={<GlossaryPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
