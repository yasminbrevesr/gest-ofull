import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Field } from '@/components/common/field'
import { PasswordInput } from '@/components/common/password-input'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage, supabase } from '@/lib/supabase'
import { GoogleButton } from './google-button'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout
      title="Que bom ver você"
      subtitle="Entre para continuar sua jornada no Mercado Livre."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-primary-text underline-offset-4 hover:underline">
            Criar conta grátis
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha" htmlFor="password">
          <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="text-right">
          <Link to="/recuperar-senha" className="text-sm font-medium text-primary-text underline-offset-4 hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading || !email || !password}>
          {loading ? (
            'Entrando…'
          ) : (
            <>
              Entrar na plataforma <ArrowRight />
            </>
          )}
        </Button>
      </form>
      <GoogleButton />
    </AuthLayout>
  )
}
