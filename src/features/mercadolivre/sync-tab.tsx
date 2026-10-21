import { ArrowLeftRight, CircleCheck, Download, RefreshCw, RotateCcw, Send, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { formatDateTime } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { pushMessage, useAcceptMlQuantity, useDivergences, useMlEvents, usePushStock, useReconcileNow, useRetryEvent, useSetSyncMode } from './api'
import { eventStatusNames, eventTopicNames, type MlConnection, type MlEvent } from './types'

export function SyncTab({ connection }: { connection: MlConnection }) {
  const disabled = connection.status !== 'active'
  return (
    <div className="space-y-6">
      {disabled && <Alert variant="danger">A sincronização está parada até você reconectar a conta.</Alert>}
      <ModeCard connection={connection} disabled={disabled} />
      <DivergencesCard connection={connection} disabled={disabled} />
      <EventsCard />
    </div>
  )
}

function ModeCard({ connection, disabled }: { connection: MlConnection; disabled: boolean }) {
  const setMode = useSetSyncMode()
  const push = usePushStock()
  const [confirmPush, setConfirmPush] = useState(false)
  const automatic = connection.sync_mode === 'automatic'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Envio do estoque para o Mercado Livre</CardTitle>
        <CardDescription>
          As vendas do Mercado Livre sempre dão baixa no estoque daqui. Este ajuste decide se as mudanças feitas aqui (entradas, ajustes, vendas por fora) vão
          sozinhas para os anúncios vinculados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label htmlFor="sync-mode" className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border p-4">
          <span className="space-y-1">
            <span className="block font-semibold">Sincronização automática</span>
            <span className="block text-sm text-muted-foreground">
              {automatic
                ? 'Ligada: cada movimentação de um produto vinculado atualiza os anúncios em até 1 minuto.'
                : 'Desligada (modo seguro): nada é enviado sem você clicar em "Enviar estoque agora".'}
            </span>
          </span>
          <Switch
            id="sync-mode"
            checked={automatic}
            disabled={disabled || setMode.isPending}
            onCheckedChange={async (on) => {
              try {
                await setMode.mutateAsync(on ? 'automatic' : 'manual')
                toast.success(on ? 'Sincronização automática ligada.' : 'Sincronização automática desligada.')
              } catch (err) {
                toast.error(errorMessage(err))
              }
            }}
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Último envio: {connection.last_sync_at ? formatDateTime(connection.last_sync_at) : 'nenhum ainda'}
            {connection.last_sync_status === 'partial' && ' (parcial)'}
            {connection.last_sync_status === 'error' && ' (com erro)'}
          </p>
          <Button onClick={() => setConfirmPush(true)} disabled={disabled || push.isPending}>
            <Send /> {push.isPending ? 'Enviando…' : 'Enviar estoque agora'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Anúncios no Full são sempre pulados: o estoque deles é controlado pelo Mercado Livre.</p>
      </CardContent>
      <ConfirmDialog
        open={confirmPush}
        onOpenChange={setConfirmPush}
        title="Enviar estoque agora?"
        description="A quantidade de cada anúncio vinculado (fora do Full) vai ficar igual ao estoque do sistema. Anúncio com estoque 0 fica pausado no Mercado Livre."
        confirmLabel="Enviar"
        loading={push.isPending}
        onConfirm={async () => {
          try {
            toast.success(pushMessage(await push.mutateAsync(undefined)))
            setConfirmPush(false)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </Card>
  )
}

function DivergencesCard({ connection, disabled }: { connection: MlConnection; disabled: boolean }) {
  const divergences = useDivergences()
  const reconcile = useReconcileNow()
  const push = usePushStock()
  const accept = useAcceptMlQuantity()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="size-5 text-primary-text" /> Conferência de estoque
        </CardTitle>
        <CardDescription>
          A cada hora comparamos o estoque daqui com o dos anúncios vinculados. Quando os números não batem, você decide qual vale.
          {connection.last_reconcile_at && ` Última conferência: ${formatDateTime(connection.last_reconcile_at)}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || reconcile.isPending}
          onClick={async () => {
            try {
              const r = await reconcile.mutateAsync()
              toast.success(r.divergences ? `${r.divergences} divergência(s) encontrada(s).` : 'Tudo certo: estoques iguais.')
            } catch (err) {
              toast.error(errorMessage(err))
            }
          }}
        >
          <RefreshCw className={cn(reconcile.isPending && 'animate-spin')} /> {reconcile.isPending ? 'Conferindo…' : 'Conferir agora'}
        </Button>

        {divergences.isLoading ? (
          <LoadingState rows={2} />
        ) : divergences.error ? (
          <ErrorState error={divergences.error} onRetry={() => divergences.refetch()} />
        ) : divergences.data!.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck className="size-5 text-primary-text" /> Nenhuma divergência: os anúncios vinculados estão com a mesma quantidade do sistema.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {divergences.data!.map((d) => (
              <li key={d.listing_id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{d.title}</p>
                  {d.variation_label && <p className="text-xs text-muted-foreground">{d.variation_label}</p>}
                  <p className="text-xs text-muted-foreground">
                    {d.ml_item_id} · Produto:{' '}
                    <Link to={`/estoque/${d.product_id}`} className="text-primary-text hover:underline">
                      {d.product_name}
                      {d.variant_name && ` — ${d.variant_name}`}
                    </Link>
                  </p>
                </div>
                <dl className="flex gap-5 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">No sistema</dt>
                    <dd className="tabular text-lg font-semibold">{d.local_quantity}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">No ML</dt>
                    <dd className="tabular text-lg font-semibold">{d.ml_quantity}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-1.5 md:w-auto">
                  <Button
                    size="sm"
                    variant="soft"
                    disabled={disabled || push.isPending}
                    title="Atualiza o anúncio com o número do sistema"
                    onClick={async () => {
                      try {
                        toast.success(pushMessage(await push.mutateAsync([d.listing_id])))
                      } catch (err) {
                        toast.error(errorMessage(err))
                      }
                    }}
                  >
                    <Upload /> Usar o do sistema
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={accept.isPending}
                    title="Registra um ajuste no estoque daqui com o número do Mercado Livre"
                    onClick={async () => {
                      try {
                        await accept.mutateAsync(d.listing_id)
                        toast.success('Estoque do sistema ajustado para o número do Mercado Livre.')
                      } catch (err) {
                        toast.error(errorMessage(err))
                      }
                    }}
                  >
                    <Download /> Usar o do ML
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

const eventBadge: Record<MlEvent['status'], 'muted' | 'warning' | 'success' | 'danger' | 'outline'> = {
  pending: 'warning',
  processing: 'warning',
  processed: 'success',
  error: 'danger',
  ignored: 'outline',
}

function EventsCard() {
  const events = useMlEvents(50)
  const retry = useRetryEvent()
  const errors = events.data?.filter((e) => e.status === 'error').length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fila de eventos</CardTitle>
        <CardDescription>
          Notificações do Mercado Livre (vendas e anúncios) e envios de estoque. Falhas temporárias são tentadas de novo sozinhas; as que esgotam as tentativas
          ficam com erro e podem ser reprocessadas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.isLoading ? (
          <LoadingState rows={3} />
        ) : events.error ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} />
        ) : events.data!.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento ainda. As vendas aparecem aqui assim que o Mercado Livre avisar.</p>
        ) : (
          <>
            {errors > 0 && (
              <Alert variant="danger" className="mb-4">
                {errors} evento(s) com erro. Corrija a causa (ex.: reconectar a conta, vincular o anúncio) e clique em “Reprocessar”.
              </Alert>
            )}
            <ul className="divide-y divide-border rounded-lg border border-border">
              {events.data!.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{eventTopicNames[e.topic] ?? e.topic}</span>
                      <Badge variant={eventBadge[e.status]}>{eventStatusNames[e.status]}</Badge>
                      {e.attempts > 1 && <span className="text-xs text-muted-foreground">{e.attempts} tentativas</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.created_at)}
                      {e.topic !== 'stock_push' && ` · ${e.resource}`}
                    </p>
                    {e.last_error && <p className="text-xs">{e.last_error}</p>}
                    {e.status === 'pending' && e.attempts > 0 && (
                      <p className="text-xs text-muted-foreground">Próxima tentativa: {formatDateTime(e.next_attempt_at)}</p>
                    )}
                  </div>
                  {e.status === 'error' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={retry.isPending}
                      onClick={async () => {
                        try {
                          const r = await retry.mutateAsync(e.id)
                          toast.success(r.failed ? 'Reprocessado, mas ainda com erro. Veja o detalhe.' : 'Evento reprocessado.')
                        } catch (err) {
                          toast.error(errorMessage(err))
                        }
                      }}
                    >
                      <RotateCcw /> Reprocessar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
