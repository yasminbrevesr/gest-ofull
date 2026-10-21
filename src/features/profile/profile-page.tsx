import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Field } from '@/components/common/field'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { PasswordInput } from '@/components/common/password-input'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { formatDate } from '@/lib/format'
import { errorMessage, supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import { profileQueryKey, useAuth, useProfile } from '@/providers/auth'
import { useTheme } from '@/providers/theme'
import { MIN_PASSWORD } from '../auth/signup-page'
import { OnboardingQuestions, type OnboardingAnswers } from '../onboarding/questions'
import { BusinessFields, validateBusiness, type BusinessValues } from './business-fields'

export default function ProfilePage() {
  const profile = useProfile()

  return (
    <>
      <PageHeader
        title={
          <>
            Meu <Highlight>perfil</Highlight>
          </>
        }
        description="Seus dados, o tipo do seu negócio e as preferências do app."
      />
      {profile.isLoading ? (
        <LoadingState rows={4} />
      ) : profile.error || !profile.data ? (
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <ProfileForm key={profile.data.updated_at} profile={profile.data} />
          <div className="space-y-6">
            <AppearanceCard />
            <PasswordCard />
            <PrivacyCard profile={profile.data} />
          </div>
        </div>
      )}
    </>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState(profile.full_name)
  const [business, setBusiness] = useState<BusinessValues>({
    person_type: profile.person_type,
    tax_regime: profile.tax_regime,
    default_tax_rate: profile.default_tax_rate,
  })
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    has_ml_account: profile.has_ml_account,
    has_cnpj: profile.has_cnpj,
    has_products: profile.has_products,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Informe seu nome.')
    const businessError = validateBusiness(business)
    if (businessError) return setError(businessError)
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), ...business, ...answers })
      .eq('user_id', profile.user_id)
    setSaving(false)
    if (error) return setError(errorMessage(error))
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(profile.user_id) })
    toast.success('Perfil salvo.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="name">
            <Input id="name" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-mail" htmlFor="email" hint="O e-mail de acesso não pode ser alterado por aqui.">
            <Input id="email" value={user?.email ?? ''} disabled readOnly />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seu negócio</CardTitle>
          <CardDescription>Usado como padrão na calculadora de lucro.</CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessFields value={business} onChange={setBusiness} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onde você está hoje</CardTitle>
          <CardDescription>Suas respostas ajustam a jornada “Como começar a vender”.</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingQuestions value={answers} onChange={setAnswers} />
        </CardContent>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}

function AppearanceCard() {
  const { theme, toggleTheme } = useTheme()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aparência</CardTitle>
      </CardHeader>
      <CardContent>
        <label htmlFor="dark-mode" className="flex cursor-pointer items-center justify-between gap-4 text-sm">
          <span>
            <span className="block font-medium">Tema escuro</span>
            <span className="text-muted-foreground">Fica salvo na sua conta.</span>
          </span>
          <Switch id="dark-mode" checked={theme === 'dark'} onCheckedChange={toggleTheme} />
        </label>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
    if (password !== confirm) return setError('As duas senhas não são iguais.')
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) return setError(errorMessage(error))
    setPassword('')
    setConfirm('')
    toast.success('Senha alterada.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trocar senha</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <Alert variant="danger">{error}</Alert>}
          <Field label="Nova senha" htmlFor="new-password">
            <PasswordInput id="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Repita a nova senha" htmlFor="confirm-password">
            <PasswordInput id="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" variant="outline" className="w-full" disabled={saving || !password}>
            {saving ? 'Salvando…' : 'Trocar senha'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PrivacyCard({ profile }: { profile: Profile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          {profile.terms_accepted_at ? `Você aceitou os termos em ${formatDate(profile.terms_accepted_at)}.` : 'Aceite dos termos pendente.'}
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/termos" className="font-medium text-primary-text underline-offset-4 hover:underline">
            Termos de Uso
          </Link>
          <Link to="/privacidade" className="font-medium text-primary-text underline-offset-4 hover:underline">
            Política de Privacidade
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
