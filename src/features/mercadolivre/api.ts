import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invokeFunction, supabase } from '@/lib/supabase'
import type { LinkStatus, MlConnection, MlListing, SyncLog } from './types'

export function useMlConnection() {
  return useQuery({
    queryKey: ['ml-connection'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_ml_connection')
      if (error) throw error
      return ((data as MlConnection[] | null)?.[0] ?? null) as MlConnection | null
    },
  })
}

/** Leva o usuário para a tela de autorização do Mercado Livre. */
export async function startConnection() {
  const { url } = await invokeFunction<{ url: string }>('ml-oauth-start')
  window.location.assign(url)
}

export const exchangeCode = (code: string, state: string) => invokeFunction<{ nickname: string }>('ml-oauth-exchange', { code, state })

export interface ImportSummary {
  items: number
  listings: number
  suggested: number
  removed: number
  failed: number
  truncated: boolean
}

export function useImportListings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => invokeFunction<ImportSummary>('ml-import-listings'),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ml-listings'] }),
        queryClient.invalidateQueries({ queryKey: ['ml-connection'] }),
        queryClient.invalidateQueries({ queryKey: ['sync-logs'] }),
      ]),
  })
}

export function useDisconnect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => invokeFunction<{ ok: boolean }>('ml-disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ml-connection'] }),
  })
}

const PAGE = 1000

export function useMlListings() {
  return useQuery({
    queryKey: ['ml-listings'],
    queryFn: async () => {
      const all: MlListing[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('ml_listings')
          .select('*')
          .order('title')
          .order('ml_variation_id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        all.push(...(data as MlListing[]))
        if (data.length < PAGE) break
      }
      return all
    },
  })
}

export interface LinkInput {
  id: string
  productId: string | null
  variantId: string | null
  status: LinkStatus
}

export function useUpdateLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, productId, variantId, status }: LinkInput) => {
      const { error } = await supabase.from('ml_listings').update({ product_id: productId, variant_id: variantId, link_status: status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ml-listings'] }),
  })
}

export function useConfirmSuggestions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('ml_listings').update({ link_status: 'linked' }).eq('link_status', 'suggested').select('id')
      if (error) throw error
      return data.length
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ml-listings'] }),
  })
}

export function useRefreshSuggestions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('suggest_my_ml_links')
      if (error) throw error
      return data as number
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ml-listings'] }),
  })
}

export function useSyncLogs(limit = 100) {
  return useQuery({
    queryKey: ['sync-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(limit)
      if (error) throw error
      return data as SyncLog[]
    },
  })
}
