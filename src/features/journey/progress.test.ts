import { describe, expect, it } from 'vitest'
import { stepState, summarizeJourney, type GuideStep } from './progress'

const step = (id: string, position: number, onboarding_flag: GuideStep['onboarding_flag'] = null): GuideStep => ({
  id,
  slug: id,
  position,
  title: id,
  summary: '',
  content: '',
  links: [],
  estimated_minutes: null,
  onboarding_flag,
  published: true,
  updated_at: '',
})

const steps = [step('conta', 10, 'has_ml_account'), step('mei', 20, 'has_cnpj'), step('certificado', 30), step('decola', 40)]
const profile = { has_ml_account: true, has_cnpj: false, has_products: false }

describe('jornada', () => {
  it('calcula o percentual pelas etapas concluídas', () => {
    expect(summarizeJourney(steps, new Set(['conta']), profile)).toMatchObject({ total: 4, done: 1, percent: 25 })
  })

  it('recomenda a primeira pendente, pulando a que a pessoa já deve ter feito', () => {
    expect(summarizeJourney(steps, new Set(), profile).next?.id).toBe('mei')
    expect(summarizeJourney(steps, new Set(['mei', 'certificado']), profile).next?.id).toBe('decola')
  })

  it('volta para as "provavelmente feitas" quando só elas faltam', () => {
    expect(summarizeJourney(steps, new Set(['mei', 'certificado', 'decola']), profile).next?.id).toBe('conta')
    expect(summarizeJourney(steps, new Set(['conta', 'mei', 'certificado', 'decola']), profile)).toMatchObject({ percent: 100, next: null })
  })

  it('indica o estado de cada etapa', () => {
    const done = new Set(['certificado'])
    expect(steps.map((s) => stepState(s, done, profile))).toEqual(['likely-done', 'todo', 'done', 'todo'])
  })
})
