/** Tipos das tabelas usadas no app (espelham as migrations em supabase/migrations). */

export type PersonType = 'pf' | 'mei' | 'empresa'
export type TaxRegime = 'mei' | 'simples' | 'outro'
export type Theme = 'light' | 'dark'

export interface Profile {
  user_id: string
  full_name: string
  person_type: PersonType | null
  tax_regime: TaxRegime | null
  default_tax_rate: number
  has_ml_account: boolean | null
  has_cnpj: boolean | null
  has_products: boolean | null
  onboarding_completed_at: string | null
  theme: Theme
  role: 'user' | 'admin'
  terms_version: string | null
  terms_accepted_at: string | null
  created_at: string
  updated_at: string
}
