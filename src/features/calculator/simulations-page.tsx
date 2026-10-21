import { ArrowLeft, Calculator, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCurrency, formatDateTime, formatPercent } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { useDeleteSimulation, useFeeData, useSimulations, type Simulation } from './api'
import { marginStatus, type ListingType, type ShippingMethod } from './engine'
import { listingTypeLabels, shippingLabels } from './labels'
import { MarginBadge } from './margin-indicator'

export default function SimulationsPage() {
  const simulations = useSimulations()
  const feeData = useFeeData()
  const remove = useDeleteSimulation()
  const [toDelete, setToDelete] = useState<Simulation | null>(null)
  const healthy = feeData.data?.settings.margin_healthy_pct ?? 15

  return (
    <>
      <PageHeader
        title={
          <>
            Minhas <Highlight>simulações</Highlight>
          </>
        }
        description="Cálculos que você salvou. Abra para revisar ou ajustar."
        actions={
          <Button asChild variant="outline">
            <Link to="/calculadora">
              <ArrowLeft /> Voltar à calculadora
            </Link>
          </Button>
        }
      />
      {simulations.isLoading ? (
        <LoadingState />
      ) : simulations.error ? (
        <ErrorState error={simulations.error} onRetry={() => simulations.refetch()} />
      ) : simulations.data!.length === 0 ? (
        <EmptyState
          icon={<Calculator />}
          title="Nenhuma simulação salva"
          description="Faça um cálculo na calculadora e clique em “Salvar simulação”."
          action={
            <Button asChild>
              <Link to="/calculadora">Abrir a calculadora</Link>
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-border">
          {simulations.data!.map((sim) => {
            const profit = sim.net_profit ?? 0
            const margin = sim.margin_pct ?? 0
            return (
              <div key={sim.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <Link to={`/calculadora?simulacao=${sim.id}`} className="font-semibold hover:text-primary-text hover:underline">
                    {sim.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(sim.created_at)}
                    {sim.listing_type && ` · ${listingTypeLabels[sim.listing_type as ListingType]}`}
                    {sim.shipping_method && ` · ${shippingLabels[sim.shipping_method as ShippingMethod]}`}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-sm sm:w-auto">
                  <div>
                    <dt className="text-xs text-muted-foreground">Preço</dt>
                    <dd className="tabular">{formatCurrency(sim.sale_price)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Lucro</dt>
                    <dd className="tabular font-semibold">{formatCurrency(sim.net_profit)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Margem</dt>
                    <dd className="tabular">{formatPercent(sim.margin_pct)}</dd>
                  </div>
                </dl>
                <div className="flex items-center gap-2">
                  <MarginBadge status={marginStatus(profit, margin, healthy)} className="text-xs" />
                  <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${sim.name}`} onClick={() => setToDelete(sim)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            )
          })}
        </Card>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir simulação?"
        description={`“${toDelete?.name}” será apagada. Isso não pode ser desfeito.`}
        confirmLabel="Excluir"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(toDelete!.id)
            toast.success('Simulação excluída.')
            setToDelete(null)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </>
  )
}
