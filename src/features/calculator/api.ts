import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { todayInBrazil, type CalculatorInputs, type FeeRule, type ProfitResult } from './engine'

export interface Category {
  id: string
  name: string
  description: string | null
  ml_category_id: string | null
  sort_order: number
  active: boolean
}

export interface AppSettings {
  fees_reviewed_on: string | null
  fees_source_url: string
  margin_healthy_pct: number
}

export interface Simulation {
  id: string
  name: string
  product_id: string | null
  listing_type: string | null
  shipping_method: string | null
  category_id: string | null
  sale_price: number | null
  net_profit: number | null
  margin_pct: number | null
  inputs: CalculatorInputs
  results: ProfitResult
  created_at: string
  updated_at: string
}

export interface FeeData {
  categories: Category[]
  rules: FeeRule[]
  settings: AppSettings
}

/** Categorias ativas, tarifas vigentes hoje e configurações da calculadora. */
export function useFeeData() {
  return useQuery({
    queryKey: ['fee-data'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FeeData> => {
      const today = todayInBrazil()
      const [categories, rules, settings] = await Promise.all([
        supabase.from('categories').select('*').eq('active', true).order('sort_order').order('name'),
        supabase.from('fee_rules').select('*').lte('valid_from', today).or(`valid_to.is.null,valid_to.gte.${today}`),
        supabase.from('app_settings').select('fees_reviewed_on, fees_source_url, margin_healthy_pct').single(),
      ])
      if (categories.error) throw categories.error
      if (rules.error) throw rules.error
      if (settings.error) throw settings.error
      return { categories: categories.data as Category[], rules: rules.data as FeeRule[], settings: settings.data as AppSettings }
    },
  })
}

export function useSimulations() {
  return useQuery({
    queryKey: ['simulations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('simulations').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as Simulation[]
    },
  })
}

export function useSimulation(id: string | null) {
  return useQuery({
    queryKey: ['simulations', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('simulations').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Simulation
    },
  })
}

export interface SaveSimulationInput {
  id?: string
  name: string
  productId: string | null
  inputs: CalculatorInputs
  result: ProfitResult
}

export function useSaveSimulation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, productId, inputs, result }: SaveSimulationInput) => {
      const row = {
        name,
        product_id: productId,
        listing_type: inputs.listingType,
        shipping_method: inputs.shippingMethod,
        category_id: inputs.categoryId,
        sale_price: inputs.salePrice,
        net_profit: result.netProfit,
        margin_pct: Math.round(result.marginPct * 100) / 100,
        inputs,
        results: result,
      }
      const query = id ? supabase.from('simulations').update(row).eq('id', id) : supabase.from('simulations').insert(row)
      const { data, error } = await query.select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulations'] }),
  })
}

export function useDeleteSimulation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('simulations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulations'] }),
  })
}
