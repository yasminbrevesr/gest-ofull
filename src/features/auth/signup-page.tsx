import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Field } from '@/components/common/field'
import { PasswordInput } from '@/components/common/password-input'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { TERMS_VERSION } from '@/lib/legal'
import { errorMessage, supabase } from '@/lib/supabase'
import { GoogleButton } from './google-button'

export const MIN_PASSWORD = 8

export default function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
    if (!accepted) return setError('Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.')

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        // O banco grava o aceite (com data/hora do servidor) ao criar o perfil.
        data: { full_name: name.trim(), terms_version: TERMS_VERSION },
      },
    })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    if (data.session) navigate('/boas-vindas', { replace: true })
    else setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <AuthLayout title="Confirme seu e-mail">
        <div className="space-y-4 text-sm leading-relaxed">
          <div className="flex size-12 items-center justify-center rounded-full bg-rose text-on-accent">
            <MailCheck />
          </div>
          <p>
            Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra o e-mail e clique no link para ativar sua conta.
          </p>
          <p className="text-muted-foreground">Não chegou? Confira a caixa de spam ou promoções. O link vale por 24 horas.</p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/entrar">Voltar para o login</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="Grátis. Em poucos minutos você sabe por onde começar."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-semibold text-primary-text underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label="Seu nome" htmlFor="name">
          <Input id="name" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha" htmlFor="password" hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}>
          <PasswordInput id="password" autoComplete="new-password" required minLength={MIN_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
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
            , e autorizo o uso dos meus dados para o funcionamento do serviço.
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={loading || !name.trim() || !email || !password}>
          {loading ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
      <GoogleButton />
    </AuthLayout>
  )
}
