import { ArrowRight, Store, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/format'
import { useMlConnection, useMlListings } from '../mercadolivre/api'

/** Resumo da integração: conectar, ou anúncios/vínculos e última sincronização. */
export function MlCard() {
  const connection = useMlConnection()
  const listings = useMlListings()

  if (connection.isLoading) return <Skeleton className="h-48 rounded-xl" />
  if (connection.error) return <ErrorState error={connection.error} onRetry={() => connection.refetch()} />

  if (!connection.data) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Mercado Livre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Conecte sua conta para importar os anúncios, dar baixa no estoque a cada venda e manter as quantidades sempre certas.
          </p>
          <Button asChild>
            <Link to="/mercado-livre">
              <Store /> Conectar Mercado Livre
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const conn = connection.data
  const all = listings.data ?? []
  const linked = all.filter((l) => l.link_status === 'linked').length
  const suggested = all.filter((l) => l.link_status === 'suggested').length
  const lastSync = conn.last_sync_at
    ? `${formatDateTime(conn.last_sync_at)}${conn.last_sync_status === 'error' ? ' (com erro)' : conn.last_sync_status === 'partial' ? ' (parcial)' : ''}`
    : 'ainda não houve'

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Mercado Livre</CardTitle>
        <Button asChild variant="link" size="sm">
          <Link to="/mercado-livre">
            Abrir <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {conn.nickname}
          {conn.status === 'reconnect_required' ? (
            <Badge variant="danger">
              <TriangleAlert /> Reconectar necessário
            </Badge>
          ) : (
            <Badge variant="success">Conectada</Badge>
          )}
        </p>
        <dl className="grid grid-cols-3 gap-2">
          <div>
            <dt className="text-xs text-muted-foreground">Anúncios</dt>
            <dd className="tabular text-lg font-semibold">{listings.isLoading ? '…' : all.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Vinculados</dt>
            <dd className="tabular text-lg font-semibold">{listings.isLoading ? '…' : linked}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sugestões</dt>
            <dd className="tabular text-lg font-semibold">{listings.isLoading ? '…' : suggested}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">Última sincronização: {lastSync}</p>
        {suggested > 0 && (
          <Button asChild size="sm" variant="soft">
            <Link to="/mercado-livre">Confirmar {suggested} vínculo(s) sugerido(s)</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
