import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Field } from '@/components/common/field'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage, supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}redefinir-senha`,
    })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    setSent(true)
  }

  return (
    <AuthLayout title="Recuperar senha" subtitle="Enviaremos um link para você criar uma senha nova.">
      {sent ? (
        <div className="space-y-4 text-sm leading-relaxed">
          <div className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/12 text-primary-text">
            <MailCheck />
          </div>
          <p>
            Se existir uma conta com <strong>{email.trim()}</strong>, você vai receber um e-mail com o link para criar uma nova senha.
          </p>
          <p className="text-muted-foreground">Confira também o spam. O link vale por 1 hora.</p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/entrar">Voltar para o login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <Alert variant="danger">{error}</Alert>}
          <Field label="E-mail da conta" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={loading || !email}>
            {loading ? 'Enviando…' : 'Enviar link'}
          </Button>
          <p className="text-center text-sm">
            <Link to="/entrar" className="font-medium text-primary-text underline-offset-4 hover:underline">
              Voltar para o login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
