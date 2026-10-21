import type { Profile } from '@/lib/types'

export interface GuideLink {
  label: string
  url: string
}

export interface GuideStep {
  id: string
  slug: string
  position: number
  title: string
  summary: string
  content: string
  links: GuideLink[]
  estimated_minutes: number | null
  onboarding_flag: 'has_ml_account' | 'has_cnpj' | 'has_products' | null
  published: boolean
  updated_at: string
}

export type StepState = 'done' | 'likely-done' | 'todo'

/** Etapa que a pessoa provavelmente já fez, pelas respostas do cadastro inicial. */
export function isLikelyDone(
  step: Pick<GuideStep, 'onboarding_flag'>,
  profile: Pick<Profile, 'has_ml_account' | 'has_cnpj' | 'has_products'> | null | undefined,
): boolean {
  return Boolean(step.onboarding_flag && profile?.[step.onboarding_flag])
}

export function stepState(step: GuideStep, completed: Set<string>, profile: Parameters<typeof isLikelyDone>[1]): StepState {
  if (completed.has(step.id)) return 'done'
  return isLikelyDone(step, profile) ? 'likely-done' : 'todo'
}

export interface JourneySummary {
  total: number
  done: number
  percent: number
  /** Próxima etapa recomendada (null quando tudo foi concluído). */
  next: GuideStep | null
}

/**
 * Progresso = etapas marcadas como concluídas. A próxima recomendada é a
 * primeira não concluída, pulando as que a pessoa provavelmente já fez.
 */
export function summarizeJourney(steps: GuideStep[], completed: Set<string>, profile: Parameters<typeof isLikelyDone>[1]): JourneySummary {
  const ordered = [...steps].sort((a, b) => a.position - b.position)
  const pending = ordered.filter((s) => !completed.has(s.id))
  const next = pending.find((s) => !isLikelyDone(s, profile)) ?? pending[0] ?? null
  const done = ordered.length - pending.length
  return { total: ordered.length, done, percent: ordered.length ? Math.round((done / ordered.length) * 100) : 0, next }
}
