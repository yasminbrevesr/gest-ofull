import type { PersonType, TaxRegime } from '@/lib/types'

export const personTypeOptions: { value: PersonType; label: string; description: string }[] = [
  { value: 'pf', label: 'Pessoa física', description: 'Vendo no meu CPF' },
  { value: 'mei', label: 'MEI', description: 'Microempreendedor individual' },
  { value: 'empresa', label: 'Empresa', description: 'ME, EPP ou outra' },
]

export const taxRegimeOptions: { value: TaxRegime; label: string; description: string }[] = [
  { value: 'mei', label: 'MEI', description: 'Imposto fixo por mês (DAS)' },
  { value: 'simples', label: 'Simples Nacional', description: '% sobre o faturamento' },
  { value: 'outro', label: 'Outro', description: 'Lucro presumido, real…' },
]

/** Alíquota sugerida (%) para preencher a calculadora. O usuário pode editar. */
export function suggestedTaxRate(personType: PersonType | null, regime: TaxRegime | null): number {
  if (personType === 'pf' || regime === 'mei') return 0
  if (regime === 'simples') return 4
  return 0
}

export const taxRateHelp =
  'É a porcentagem de imposto que você paga sobre cada venda. MEI paga um valor fixo por mês (DAS), então use 0% aqui. No Simples Nacional, comércio começa em 4% e sobe conforme o faturamento. Na dúvida, pergunte ao seu contador.'
