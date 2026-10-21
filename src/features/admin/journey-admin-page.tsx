import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import type { GuideStep } from '../journey/progress'
import { useAllGuideSteps, useDeleteGuideStep, useReorderGuideSteps } from './api'

export default function JourneyAdminPage() {
  const steps = useAllGuideSteps()
  const reorder = useReorderGuideSteps()
  const remove = useDeleteGuideStep()
  const [toDelete, setToDelete] = useState<GuideStep | null>(null)

  async function move(index: number, delta: -1 | 1) {
    const list = [...steps.data!]
    const [item] = list.splice(index, 1)
    list.splice(index + delta, 0, item)
    try {
      await reorder.mutateAsync(list.map((s) => s.id))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Etapas da trilha “Como começar a vender”, na ordem em que aparecem.</p>
        <Button asChild>
          <Link to="/admin/jornada/nova">
            <Plus /> Nova etapa
          </Link>
        </Button>
      </div>
      {steps.isLoading ? (
        <LoadingState rows={6} />
      ) : steps.error ? (
        <ErrorState error={steps.error} onRetry={() => steps.refetch()} />
      ) : steps.data!.length === 0 ? (
        <EmptyState title="Nenhuma etapa" description="Crie a primeira etapa da jornada." />
      ) : (
        <Card className="divide-y divide-border">
          {steps.data!.map((step, index) => (
            <div key={step.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/12 font-display font-bold text-primary-text">
                  {index + 1}
                </span>
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Descer"
                    disabled={index === steps.data!.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {step.title}
                  {!step.published && (
                    <Badge variant="muted">
                      <EyeOff /> Rascunho
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  /jornada/{step.slug} · atualizada em {formatDateTime(step.updated_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/admin/jornada/${step.id}`}>
                    <Pencil /> Editar
                  </Link>
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${step.title}`} onClick={() => setToDelete(step)}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir etapa?"
        description={`“${toDelete?.title}” e o progresso dos usuários nesta etapa serão apagados. Para só esconder, desmarque “Publicada” na edição.`}
        confirmLabel="Excluir"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(toDelete!.id)
            toast.success('Etapa excluída.')
            setToDelete(null)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </div>
  )
}
