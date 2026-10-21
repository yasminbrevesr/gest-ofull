import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Field } from '@/components/common/field'
import { FullPageLoading } from '@/components/common/states'
import { Brand } from '@/components/layout/brand'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/misc'
import { TERMS_VERSION } from '@/lib/legal'
import { errorMessage, supabase } from '@/lib/supabase'
import { profileQueryKey, useAuth, useProfile } from '@/providers/auth'
import { BusinessFields, validateBusiness, type BusinessValues } from '../profile/business-fields'
import { suggestedTaxRate } from '../profile/profile-options'
import { answersComplete, OnboardingQuestions, type OnboardingAnswers } from './questions'

/** Primeira entrada: 3 perguntas para personalizar a jornada + dados do negócio. */
export default function OnboardingPage() {
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile()

  if (isLoading || !profile) return <FullPageLoading />
  if (profile.onboarding_completed_at) return <Navigate to="/" replace />

  return <OnboardingForm key={profile.user_id} userId={user!.id} initialName={profile.full_name} needsConsent={!profile.terms_accepted_at} />
}

function OnboardingForm({ userId, initialName, needsConsent }: { userId: string; initialName: string; needsConsent: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [answers, setAnswers] = useState<OnboardingAnswers>({ has_ml_account: null, has_cnpj: null, has_products: null })
  const [name, setName] = useState(initialName)
  const [business, setBusiness] = useState<BusinessValues>({ person_type: null, tax_regime: null, default_tax_rate: 0 })
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function goToStep2() {
    // Pré-preenche o tipo de vendedor a partir da resposta sobre CNPJ.
    if (!business.person_type) {
      const person_type = answers.has_cnpj ? 'mei' : 'pf'
      const tax_regime = answers.has_cnpj ? 'mei' : null
      setBusiness({ person_type, tax_regime, default_tax_rate: suggestedTaxRate(person_type, tax_regime) })
    }
    setStep(2)
  }

  async function finish() {
    setError(null)
    if (!name.trim()) return setError('Conte como podemos chamar você.')
    const businessError = validateBusiness(business)
    if (businessError) return setError(businessError)
    if (needsConsent && !accepted) return setError('Para continuar, aceite os Termos de Uso e a Política de Privacidade.')

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        ...answers,
        ...business,
        onboarding_completed_at: new Date().toISOString(),
        ...(needsConsent ? { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() } : {}),
      })
      .eq('user_id', userId)
    setSaving(false)
    if (error) return setError(errorMessage(error))
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) })
    toast.success('Tudo pronto! Preparamos sua jornada.')
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Brand />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16">
        <div className="mb-6 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Passo {step} de 2</p>
          <Progress value={step === 1 ? 50 : 100} aria-label="Progresso do cadastro" />
        </div>
        <Card className="p-6 sm:p-8">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl">
                  Boas-vindas! Vamos montar <span className="text-primary-text">sua jornada</span>
                </h1>
                <p className="text-muted-foreground">Três perguntas rápidas para mostrar primeiro o que faz sentido para você.</p>
              </div>
              <OnboardingQuestions value={answers} onChange={setAnswers} />
              <div className="flex justify-end">
                <Button onClick={goToStep2} disabled={!answersComplete(answers)}>
                  Continuar <ArrowRight />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl">
                  Sobre <span className="text-primary-text">o seu negócio</span>
                </h1>
                <p className="text-muted-foreground">Usamos isso para calcular o lucro de cada venda. Dá para mudar depois em “Meu perfil”.</p>
              </div>
              {error && <Alert variant="danger">{error}</Alert>}
              <Field label="Como podemos chamar você?" htmlFor="name">
                <Input id="name" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <BusinessFields value={business} onChange={setBusiness} />
              {needsConsent && (
                <label htmlFor="terms" className="flex items-start gap-3 text-sm leading-relaxed">
                  <Checkbox id="terms" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                  <span>
                    Li e aceito os{' '}
                    <Link to="/termos" target="_blank" className="font-semibold text-primary-text underline underline-offset-2">
                      Termos de Uso
                    </Link>{' '}
                    e a{' '}
                    <Link to="/privacidade" target="_blank" className="font-semibold text-primary-text underline underline-offset-2">
                      Política de Privacidade
                    </Link>
                    .
                  </span>
                </label>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft /> Voltar
                </Button>
                <Button onClick={finish} disabled={saving}>
                  {saving ? 'Salvando…' : 'Começar'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
