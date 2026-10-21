import { RadioCards } from '@/components/ui/radio-cards'

export interface OnboardingAnswers {
  has_ml_account: boolean | null
  has_cnpj: boolean | null
  has_products: boolean | null
}

const questions: { key: keyof OnboardingAnswers; label: string; hintYes: string; hintNo: string }[] = [
  { key: 'has_ml_account', label: 'Você já tem conta de vendedor no Mercado Livre?', hintYes: 'Já criei', hintNo: 'Ainda não' },
  { key: 'has_cnpj', label: 'Você já tem CNPJ (MEI ou empresa)?', hintYes: 'Tenho CNPJ', hintNo: 'Ainda não' },
  { key: 'has_products', label: 'Você já tem produtos para vender?', hintYes: 'Já tenho', hintNo: 'Ainda estou escolhendo' },
]

const toChoice = (v: boolean | null) => (v == null ? undefined : v ? 'sim' : 'nao')

export function OnboardingQuestions({ value, onChange }: { value: OnboardingAnswers; onChange: (next: OnboardingAnswers) => void }) {
  return (
    <div className="space-y-6">
      {questions.map((q) => (
        <div key={q.key} className="space-y-2">
          <p id={`q-${q.key}`} className="font-medium">
            {q.label}
          </p>
          <RadioCards
            aria-labelledby={`q-${q.key}`}
            value={toChoice(value[q.key])}
            onValueChange={(v) => onChange({ ...value, [q.key]: v === 'sim' })}
            options={[
              { value: 'sim', label: 'Sim', description: q.hintYes },
              { value: 'nao', label: 'Não', description: q.hintNo },
            ]}
          />
        </div>
      ))}
    </div>
  )
}

export const answersComplete = (a: OnboardingAnswers) => a.has_ml_account != null && a.has_cnpj != null && a.has_products != null
