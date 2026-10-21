import { Eye, Lock, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorMessage } from '@/lib/supabase'
import { startConnection } from './api'

const points = [
  { icon: Eye, text: 'Lemos seus anúncios e pedidos para ligar cada anúncio ao produto do estoque e dar baixa nas vendas.' },
  { icon: RefreshCw, text: 'Atualizamos só a quantidade disponível dos anúncios que você vincular — e só quando você quiser.' },
  { icon: PackageCheck, text: 'Anúncios no Full têm o estoque controlado pelo Mercado Livre: nós só lemos, nunca alteramos.' },
  { icon: Lock, text: 'Sua senha do Mercado Livre nunca passa por aqui. As chaves de acesso ficam criptografadas.' },
]

export function ConnectCard({ reconnect = false }: { reconnect?: boolean }) {
  const [loading, setLoading] = useState(false)

  async function connect() {
    setLoading(true)
    try {
      await startConnection()
    } catch (err) {
      toast.error(errorMessage(err))
      setLoading(false)
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-butter text-on-accent">
          <ShieldCheck />
        </span>
        <CardTitle className="text-2xl">{reconnect ? 'Reconecte sua conta do Mercado Livre' : 'Conecte sua conta do Mercado Livre'}</CardTitle>
        <CardDescription>
          {reconnect
            ? 'O acesso expirou ou foi revogado. Reconecte para voltar a sincronizar — seus vínculos continuam salvos.'
            : 'Você será levado ao site do Mercado Livre para autorizar o acesso, e depois volta para cá.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-3">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm leading-relaxed">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
        <Button size="lg" className="w-full" onClick={connect} disabled={loading}>
          {loading ? 'Abrindo o Mercado Livre…' : reconnect ? 'Reconectar minha conta' : 'Conectar minha conta do Mercado Livre'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Dá para desconectar a qualquer momento, aqui ou nas configurações de segurança do Mercado Livre.
        </p>
      </CardContent>
    </Card>
  )
}
