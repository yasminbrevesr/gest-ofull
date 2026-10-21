import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invokeFunction, supabase } from '@/lib/supabase'
import type { Divergence, LinkStatus, MlConnection, MlEvent, MlListing, SyncLog } from './types'

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

/** Anúncios vinculados a um produto (página do produto). */
export function useListingsForProduct(productId: string) {
  return useQuery({
    queryKey: ['ml-listings', 'produto', productId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ml_listings').select('*').eq('product_id', productId).eq('link_status', 'linked').order('title')
      if (error) throw error
      return data as MlListing[]
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

function useInvalidateSync() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      ['ml-connection', 'ml-listings', 'ml-divergences', 'ml-events', 'sync-logs', 'products', 'stock-items', 'stock-movements'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    )
}

export function useSetSyncMode() {
  const invalidate = useInvalidateSync()
  return useMutation({
    mutationFn: async (mode: 'manual' | 'automatic') => {
      const { error } = await supabase.rpc('set_ml_sync_mode', { p_mode: mode })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export interface PushSummary {
  pushed: number
  unchanged: number
  skipped: number
  failed: number
}

export function usePushStock() {
  const invalidate = useInvalidateSync()
  return useMutation({
    mutationFn: (listingIds?: string[]) => invokeFunction<PushSummary>('ml-push-stock', listingIds ? { listingIds } : {}),
    onSettled: invalidate,
  })
}

export function pushMessage(s: PushSummary) {
  const parts: string[] = []
  if (s.pushed) parts.push(`${s.pushed} anúncio(s) atualizado(s)`)
  if (s.unchanged) parts.push(`${s.unchanged} já estava(m) certo(s)`)
  if (s.skipped) parts.push(`${s.skipped} pulado(s) (Full ou finalizado)`)
  if (s.failed) parts.push(`${s.failed} com erro (veja o registro)`)
  return parts.join(', ') + '.'
}

export function useReconcileNow() {
  const invalidate = useInvalidateSync()
  return useMutation({
    mutationFn: () => invokeFunction<{ listings: number; divergences: number; failures: number }>('ml-reconcile'),
    onSettled: invalidate,
  })
}

export function useDivergences() {
  return useQuery({
    queryKey: ['ml-divergences'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ml_stock_divergences').select('*').order('title')
      if (error) throw error
      return data as Divergence[]
    },
  })
}

export function useAcceptMlQuantity() {
  const invalidate = useInvalidateSync()
  return useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase.rpc('accept_ml_quantity', { p_listing_id: listingId })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useMlEvents(limit = 50) {
  return useQuery({
    queryKey: ['ml-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ml_events')
        .select('id, source, topic, resource, status, attempts, next_attempt_at, last_error, processed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as MlEvent[]
    },
  })
}

/** "Reprocessar": volta o evento para a fila e já processa. */
export function useRetryEvent() {
  const invalidate = useInvalidateSync()
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('retry_ml_event', { p_event_id: eventId })
      if (error) throw error
      return invokeFunction<{ processed: number; failed: number }>('ml-process-events')
    },
    onSettled: invalidate,
  })
}
