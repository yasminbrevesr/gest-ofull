import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AppSettings, Category } from '../calculator/api'
import type { FeeRule } from '../calculator/engine'
import type { GlossaryTerm } from '../glossary/api'
import type { GuideStep } from '../journey/progress'

// --- Jornada --------------------------------------------------------------------

/** Todas as etapas, inclusive as não publicadas (admin). */
export function useAllGuideSteps() {
  return useQuery({
    queryKey: ['guide-steps', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('guide_steps').select('*').order('position')
      if (error) throw error
      return data as GuideStep[]
    },
  })
}

export type GuideStepInput = Pick<GuideStep, 'slug' | 'title' | 'summary' | 'content' | 'links' | 'estimated_minutes' | 'onboarding_flag' | 'published'> & {
  position?: number
}

function useInvalidate(keys: string[]) {
  const queryClient = useQueryClient()
  return () => Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
}

export function useSaveGuideStep() {
  const invalidate = useInvalidate(['guide-steps'])
  return useMutation({
    mutationFn: async ({ id, ...input }: GuideStepInput & { id?: string }) => {
      const query = id ? supabase.from('guide_steps').update(input).eq('id', id) : supabase.from('guide_steps').insert(input)
      const { data, error } = await query.select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: invalidate,
  })
}

export function useDeleteGuideStep() {
  const invalidate = useInvalidate(['guide-steps', 'guide-progress'])
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('guide_steps').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useReorderGuideSteps() {
  const invalidate = useInvalidate(['guide-steps'])
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('admin_reorder_guide_steps', { p_ids: ids })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// --- Glossário ------------------------------------------------------------------

export type GlossaryInput = Pick<GlossaryTerm, 'slug' | 'term' | 'short_definition' | 'details'>

export function useSaveGlossaryTerm() {
  const invalidate = useInvalidate(['glossary'])
  return useMutation({
    mutationFn: async ({ id, ...input }: GlossaryInput & { id?: string }) => {
      const { error } = id ? await supabase.from('glossary_terms').update(input).eq('id', id) : await supabase.from('glossary_terms').insert(input)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteGlossaryTerm() {
  const invalidate = useInvalidate(['glossary'])
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('glossary_terms').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// --- Tarifas --------------------------------------------------------------------

export interface FeesAdminData {
  categories: Category[]
  rules: FeeRule[]
  settings: AppSettings
}

/** Todas as categorias (inclusive inativas) e todas as regras (histórico completo). */
export function useFeesAdmin() {
  return useQuery({
    queryKey: ['fee-data', 'admin'],
    queryFn: async (): Promise<FeesAdminData> => {
      const [categories, rules, settings] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order').order('name'),
        supabase.from('fee_rules').select('*').order('valid_from', { ascending: false }),
        supabase.from('app_settings').select('fees_reviewed_on, fees_source_url, margin_healthy_pct').single(),
      ])
      if (categories.error) throw categories.error
      if (rules.error) throw rules.error
      if (settings.error) throw settings.error
      return { categories: categories.data as Category[], rules: rules.data as FeeRule[], settings: settings.data as AppSettings }
    },
  })
}

export function useSaveSettings() {
  const invalidate = useInvalidate(['fee-data'])
  return useMutation({
    mutationFn: async (settings: AppSettings) => {
      const { error } = await supabase.from('app_settings').update(settings).eq('id', 1)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export type CategoryInput = Pick<Category, 'name' | 'description' | 'ml_category_id' | 'sort_order' | 'active'>

export function useSaveCategory() {
  const invalidate = useInvalidate(['fee-data'])
  return useMutation({
    mutationFn: async ({ id, ...input }: CategoryInput & { id?: string }) => {
      const query = id ? supabase.from('categories').update(input).eq('id', id) : supabase.from('categories').insert(input)
      const { data, error } = await query.select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: invalidate,
  })
}

export type FeeRuleInput = Omit<FeeRule, 'id'>

/** Cria a regra nova e encerra a equivalente em vigor (função admin_replace_fee_rule). */
export function useReplaceFeeRule() {
  const invalidate = useInvalidate(['fee-data'])
  return useMutation({
    mutationFn: async (rule: FeeRuleInput) => {
      const { error } = await supabase.rpc('admin_replace_fee_rule', { p_rule: rule })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateFeeRule() {
  const invalidate = useInvalidate(['fee-data'])
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<FeeRule> & { id: string }) => {
      const { error } = await supabase.from('fee_rules').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteFeeRule() {
  const invalidate = useInvalidate(['fee-data'])
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_rules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// --- Usuários -------------------------------------------------------------------

export interface AdminUser {
  user_id: string
  email: string
  full_name: string | null
  person_type: string | null
  role: 'user' | 'admin'
  created_at: string
  last_sign_in_at: string | null
  onboarding_completed_at: string | null
  products_count: number
  ml_nickname: string | null
  ml_status: 'active' | 'reconnect_required' | null
  ml_sync_mode: 'manual' | 'automatic' | null
  ml_last_sync_at: string | null
  ml_last_sync_status: 'success' | 'partial' | 'error' | null
  ml_listings_count: number
  ml_events_errors: number
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users')
      if (error) throw error
      return data as AdminUser[]
    },
  })
}
