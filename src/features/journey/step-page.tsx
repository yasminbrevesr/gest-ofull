import { ArrowLeft, ArrowRight, CircleCheck, ExternalLink, Undo2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Markdown } from '@/components/common/markdown'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { useProfile } from '@/providers/auth'
import { useGuideProgress, useGuideSteps, useToggleStep } from './api'
import { stepState } from './progress'
import { StepBadge } from './step-badge'

const flagHints = {
  has_ml_account: 'Você contou que já tem conta de vendedor. Se já fez tudo daqui, é só marcar como concluída.',
  has_cnpj: 'Você contou que já tem CNPJ. Se já está tudo certo, é só marcar como concluída.',
  has_products: 'Você contou que já tem produtos. Confira se já fez o que está aqui e marque como concluída.',
}

export default function StepPage() {
  const { slug } = useParams()
  const steps = useGuideSteps()
  const progress = useGuideProgress()
  const toggle = useToggleStep()
  const { data: profile } = useProfile()

  if (steps.isLoading || progress.isLoading) return <LoadingState rows={6} />
  if (steps.error || progress.error) return <ErrorState error={steps.error ?? progress.error} onRetry={() => (steps.refetch(), progress.refetch())} />

  const index = steps.data!.findIndex((s) => s.slug === slug)
  const step = steps.data![index]
  if (!step) {
    return (
      <EmptyState
        title="Etapa não encontrada"
        action={
          <Button asChild>
            <Link to="/jornada">Ver a jornada</Link>
          </Button>
        }
      />
    )
  }

  const completedAt = progress.data!.get(step.id)
  const state = stepState(step, new Set(progress.data!.keys()), profile)
  const previous = steps.data![index - 1]
  const next = steps.data![index + 1]

  async function setDone(done: boolean) {
    try {
      await toggle.mutateAsync({ stepId: step.id, done })
      toast.success(done ? 'Etapa concluída! Bom trabalho.' : 'Etapa marcada como pendente.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link to="/jornada" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline">
        <ArrowLeft className="size-4" /> Jornada
      </Link>

      <header className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">
          Etapa {index + 1} de {steps.data!.length}
        </p>
        <h1 className="text-2xl leading-tight sm:text-3xl">{step.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <StepBadge state={state} />
          {completedAt && <span className="text-xs text-muted-foreground">Concluída em {formatDate(completedAt)}</span>}
        </div>
      </header>

      {state === 'likely-done' && step.onboarding_flag && <Alert variant="tip">{flagHints[step.onboarding_flag]}</Alert>}

      <Card className="p-5 sm:p-8">
        <Markdown>{step.content}</Markdown>
      </Card>

      {step.links.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Links oficiais</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {step.links.map((link) => (
                <li key={link.url}>
                  {link.url.startsWith('/') ? (
                    <Link to={link.url} className="inline-flex items-center gap-1.5 font-medium text-primary-text underline-offset-4 hover:underline">
                      <ArrowRight className="size-4" /> {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-primary-text underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="size-4" /> {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        {completedAt ? (
          <Button variant="outline" onClick={() => setDone(false)} disabled={toggle.isPending}>
            <Undo2 /> Marcar como pendente
          </Button>
        ) : (
          <Button size="lg" onClick={() => setDone(true)} disabled={toggle.isPending}>
            <CircleCheck /> Marcar como concluída
          </Button>
        )}
        <div className="flex gap-2">
          {previous && (
            <Button asChild variant="ghost" className="flex-1">
              <Link to={`/jornada/${previous.slug}`}>
                <ArrowLeft /> Anterior
              </Link>
            </Button>
          )}
          {next && (
            <Button asChild variant="outline" className="flex-1">
              <Link to={`/jornada/${next.slug}`}>
                Próxima <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
