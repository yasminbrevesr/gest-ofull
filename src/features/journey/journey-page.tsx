import { ArrowRight, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { useProfile } from '@/providers/auth'
import { useGuideProgress, useGuideSteps } from './api'
import { stepState, summarizeJourney } from './progress'
import { StepBadge } from './step-badge'

export default function JourneyPage() {
  const steps = useGuideSteps()
  const progress = useGuideProgress()
  const { data: profile } = useProfile()

  const header = (
    <PageHeader
      title={
        <>
          Como começar a <Highlight>vender</Highlight>
        </>
      }
      description="Um passo de cada vez: do cadastro à primeira venda. Marque cada etapa quando concluir."
    />
  )

  if (steps.isLoading || progress.isLoading)
    return (
      <>
        {header}
        <LoadingState rows={6} />
      </>
    )
  if (steps.error || progress.error)
    return (
      <>
        {header}
        <ErrorState error={steps.error ?? progress.error} onRetry={() => (steps.refetch(), progress.refetch())} />
      </>
    )
  if (!steps.data!.length)
    return (
      <>
        {header}
        <EmptyState title="A jornada ainda não tem etapas" description="Em breve o conteúdo estará disponível." />
      </>
    )

  const completed = new Set(progress.data!.keys())
  const summary = summarizeJourney(steps.data!, completed, profile)

  return (
    <>
      {header}
      <Card className="mb-6 space-y-3 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="font-semibold">
            {summary.done} de {summary.total} etapas concluídas
          </p>
          <p className="tabular font-display text-2xl font-semibold text-primary-text">{summary.percent}%</p>
        </div>
        <Progress value={summary.percent} aria-label="Progresso da jornada" />
        {summary.next ? (
          <p className="text-sm text-muted-foreground">
            Próxima etapa recomendada:{' '}
            <Link to={`/jornada/${summary.next.slug}`} className="font-semibold text-primary-text underline-offset-4 hover:underline">
              {summary.next.title}
            </Link>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Parabéns! Você concluiu toda a jornada.</p>
        )}
      </Card>

      <ol className="space-y-3">
        {steps.data!.map((step, index) => {
          const state = stepState(step, completed, profile)
          const isNext = summary.next?.id === step.id
          return (
            <li key={step.id}>
              <Link to={`/jornada/${step.slug}`} className="group block rounded-xl">
                <Card
                  className={cn(
                    'flex gap-4 p-4 transition-colors duration-150 group-hover:border-primary/60 sm:p-5',
                    isNext && 'border-primary ring-1 ring-primary',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold',
                      state === 'done' ? 'bg-primary text-primary-foreground' : 'border border-primary/30 bg-primary/12 text-primary-text',
                    )}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg leading-snug">{step.title}</h2>
                      {isNext && <span className="text-xs font-semibold text-primary-text uppercase">Próxima</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.summary}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <StepBadge state={state} />
                      {step.estimated_minutes && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3.5" aria-hidden /> cerca de {step.estimated_minutes} min
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight
                    className="mt-2 size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Card>
              </Link>
            </li>
          )
        })}
      </ol>

      <div className="mt-6 text-center">
        <Button asChild variant="link">
          <Link to="/glossario">Dúvida com algum termo? Veja o glossário</Link>
        </Button>
      </div>
    </>
  )
}
