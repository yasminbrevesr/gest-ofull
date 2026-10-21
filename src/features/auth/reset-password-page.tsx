import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Field } from '@/components/common/field'
import { PasswordInput } from '@/components/common/password-input'
import { FullPageLoading } from '@/components/common/states'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { errorMessage, supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import { MIN_PASSWORD } from './signup-page'

export default function ResetPasswordPage() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (authLoading) return <FullPageLoading />

  if (!session) {
    return (
      <AuthLayout title="Link expirado">
        <div className="space-y-4 text-sm">
          <p>Este link de troca de senha não é mais válido. Peça um novo e use o link mais recente que chegar no e-mail.</p>
          <Button asChild className="w-full">
            <Link to="/recuperar-senha">Pedir novo link</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
    if (password !== confirm) return setError('As duas senhas não são iguais.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    toast.success('Senha alterada!')
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Crie uma nova senha">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label="Nova senha" htmlFor="password" hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Repita a nova senha" htmlFor="confirm">
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={loading || !password || !confirm}>
          {loading ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthLayout>
  )
}
