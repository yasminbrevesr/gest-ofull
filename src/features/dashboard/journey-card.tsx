import { ArrowRight, Map as MapIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress, Skeleton } from '@/components/ui/misc'
import { useProfile } from '@/providers/auth'
import { useGuideProgress, useGuideSteps } from '../journey/api'
import { summarizeJourney } from '../journey/progress'

/** Progresso da jornada e próxima etapa recomendada. */
export function JourneyCard() {
  const steps = useGuideSteps()
  const progress = useGuideProgress()
  const { data: profile } = useProfile()

  if (steps.isLoading || progress.isLoading) return <Skeleton className="h-44 rounded-xl" />
  if (steps.error || progress.error) return <ErrorState error={steps.error ?? progress.error} onRetry={() => (steps.refetch(), progress.refetch())} />

  const summary = summarizeJourney(steps.data!, new Set(progress.data!.keys()), profile)

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <MapIcon className="size-4" aria-hidden /> Sua jornada
          </div>
          <div className="flex items-baseline gap-3">
            <p className="tabular font-serif text-4xl font-semibold text-primary-text">{summary.percent}%</p>
            <p className="text-sm text-muted-foreground">
              {summary.done} de {summary.total} etapas concluídas
            </p>
          </div>
          <Progress value={summary.percent} aria-label="Progresso da jornada" />
        </div>
        <div className="rounded-lg bg-rose/40 p-4 text-on-accent sm:max-w-xs dark:bg-rose/80">
          {summary.next ? (
            <>
              <p className="text-xs font-semibold uppercase">Próxima etapa</p>
              <p className="mt-1 font-serif text-lg leading-snug font-semibold">{summary.next.title}</p>
              <Button asChild size="sm" className="mt-3">
                <Link to={`/jornada/${summary.next.slug}`}>
                  Continuar <ArrowRight />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <p className="font-serif text-lg font-semibold">Jornada concluída! 🎉</p>
              <p className="mt-1 text-sm">Agora é manter o estoque em dia e calcular cada preço.</p>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
