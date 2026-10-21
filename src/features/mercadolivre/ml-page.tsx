import { LogOut, RefreshCw, ScrollText, Store, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useDisconnect, useImportListings, useMlConnection, type ImportSummary } from './api'
import { ConnectCard } from './connect-card'
import { ListingsTab } from './listings-tab'
import { SyncLogTab } from './sync-log-tab'
import type { MlConnection } from './types'

export function importMessage(s: ImportSummary) {
  const parts = [`${s.items} anúncio(s) importado(s)`]
  if (s.suggested) parts.push(`${s.suggested} vínculo(s) sugerido(s) pelo SKU`)
  if (s.failed) parts.push(`${s.failed} com erro (veja o registro)`)
  return parts.join(', ') + '.'
}

export default function MercadoLivrePage() {
  const connection = useMlConnection()

  return (
    <>
      <PageHeader
        title={
          <>
            Mercado <Highlight>Livre</Highlight>
          </>
        }
        description="Conecte sua conta, ligue cada anúncio ao produto do estoque e acompanhe a sincronização."
      />
      {connection.isLoading ? (
        <LoadingState rows={4} />
      ) : connection.error ? (
        <ErrorState error={connection.error} onRetry={() => connection.refetch()} />
      ) : !connection.data ? (
        <ConnectCard />
      ) : (
        <Connected connection={connection.data} />
      )}
    </>
  )
}

function Connected({ connection }: { connection: MlConnection }) {
  const [params, setParams] = useSearchParams()
  const tab = params.get('aba') ?? 'anuncios'
  const importer = useImportListings()
  const disconnect = useDisconnect()
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const needsReconnect = connection.status === 'reconnect_required'

  async function runImport() {
    try {
      toast.success(importMessage(await importer.mutateAsync()))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      {needsReconnect && <ConnectCard reconnect />}

      <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-butter text-on-accent">
            <Store className="size-5" />
          </span>
          <div>
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {connection.nickname ?? `Vendedor ${connection.seller_id}`}
              {needsReconnect ? (
                <Badge variant="danger">
                  <TriangleAlert /> Reconectar necessário
                </Badge>
              ) : (
                <Badge variant="success">Conectada</Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Conectada em {formatDateTime(connection.connected_at)}
              {connection.last_import_at && ` · Última importação: ${formatDateTime(connection.last_import_at)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={runImport} disabled={importer.isPending || needsReconnect}>
            <RefreshCw className={cn(importer.isPending && 'animate-spin')} /> {importer.isPending ? 'Importando…' : 'Importar anúncios'}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDisconnect(true)}>
            <LogOut /> Desconectar
          </Button>
        </div>
      </Card>

      {connection.last_error && !needsReconnect && <Alert variant="warning">{connection.last_error}</Alert>}

      <Tabs value={tab} onValueChange={(v) => setParams({ aba: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="anuncios">
            <Store /> Anúncios
          </TabsTrigger>
          <TabsTrigger value="registro">
            <ScrollText /> Registro
          </TabsTrigger>
        </TabsList>
        <TabsContent value="anuncios">
          <ListingsTab onImport={runImport} importing={importer.isPending} />
        </TabsContent>
        <TabsContent value="registro">
          <SyncLogTab />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Desconectar do Mercado Livre?"
        description="Paramos de receber vendas e de enviar estoque. Os vínculos dos anúncios ficam salvos para quando você conectar de novo."
        confirmLabel="Desconectar"
        destructive
        loading={disconnect.isPending}
        onConfirm={async () => {
          try {
            await disconnect.mutateAsync()
            toast.success('Conta desconectada.')
            setConfirmDisconnect(false)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </div>
  )
}
