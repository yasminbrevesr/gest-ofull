// Envio do estoque do sistema para o Mercado Livre (anúncios vinculados).
// Anúncios no Full nunca são alterados: o estoque é do Mercado Livre.
import { errorText, logInfo } from './log.ts'
import { MlApiError, mlRequest } from './ml-api.ts'
import type { Admin } from './supabase.ts'
import { writeSyncLog, type SyncLogEntry } from './sync-log.ts'

export interface LinkedListing {
  id: string
  user_id: string
  ml_item_id: string
  ml_variation_id: number
  title: string
  variation_label: string | null
  product_id: string
  variant_id: string | null
  is_full: boolean
  ml_available_quantity: number | null
}

interface MlItemStock {
  id: string
  status?: string
  available_quantity?: number
  shipping?: { logistic_type?: string | null } | null
  variations?: { id: number; available_quantity?: number }[]
}

export interface PushSummary {
  pushed: number
  unchanged: number
  skipped: number
  failed: number
  /** Algum erro temporário (vale tentar de novo depois). */
  retryable: boolean
}

export const LISTING_COLUMNS = 'id, user_id, ml_item_id, ml_variation_id, title, variation_label, product_id, variant_id, is_full, ml_available_quantity'

const stockKey = (productId: string, variantId: string | null) => `${productId}|${variantId ?? ''}`

/** Saldo atual do sistema para os produtos/variações dos anúncios (negativo vira 0). */
export async function localQuantities(admin: Admin, userId: string, listings: LinkedListing[]): Promise<Map<string, number>> {
  const productIds = [...new Set(listings.map((l) => l.product_id))]
  const map = new Map<string, number>()
  if (!productIds.length) return map
  const { data, error } = await admin.from('stock_items').select('product_id, variant_id, current_stock').eq('user_id', userId).in('product_id', productIds)
  if (error) throw error
  for (const row of data ?? []) map.set(stockKey(row.product_id, row.variant_id), Math.max(0, row.current_stock))
  return map
}

/** Quantidade em uma variação ou no anúncio, na resposta da API. */
function quantityIn(item: MlItemStock, variationId: number): number | undefined {
  if (variationId === 0) return item.available_quantity
  return item.variations?.find((v) => v.id === variationId)?.available_quantity
}

/** Monta o corpo do PUT. Com variações, manda todas (só o id das que não mudam) para nenhuma ser apagada. */
export function buildStockUpdate(item: MlItemStock, desired: Map<number, number>): { body: Record<string, unknown> } | { error: string } {
  const variations = item.variations ?? []
  if (desired.has(0)) {
    if (variations.length) return { error: 'O anúncio passou a ter variações. Importe os anúncios de novo e refaça o vínculo.' }
    return { body: { available_quantity: desired.get(0) } }
  }
  const ids = new Set(variations.map((v) => v.id))
  const missing = [...desired.keys()].filter((id) => !ids.has(id))
  if (missing.length) return { error: 'A variação não existe mais no anúncio. Importe os anúncios de novo.' }
  return { body: { variations: variations.map((v) => (desired.has(v.id) ? { id: v.id, available_quantity: desired.get(v.id) } : { id: v.id })) } }
}

export async function pushListings(
  admin: Admin,
  userId: string,
  token: string,
  listings: LinkedListing[],
  eventId: string | null = null,
): Promise<PushSummary> {
  const summary: PushSummary = { pushed: 0, unchanged: 0, skipped: 0, failed: 0, retryable: false }
  const quantities = await localQuantities(admin, userId, listings)
  const byItem = new Map<string, LinkedListing[]>()
  for (const l of listings) byItem.set(l.ml_item_id, [...(byItem.get(l.ml_item_id) ?? []), l])

  const logs: SyncLogEntry[] = []
  const now = () => new Date().toISOString()
  const base = (l: LinkedListing) => ({
    user_id: userId,
    kind: 'push_stock' as const,
    ml_item_id: l.ml_item_id,
    ml_variation_id: l.ml_variation_id || null,
    product_id: l.product_id,
    variant_id: l.variant_id,
    event_id: eventId,
  })
  const name = (l: LinkedListing) => `${l.title}${l.variation_label ? ` (${l.variation_label})` : ''}`

  async function markSkipped(targets: LinkedListing[], reason: string, extra: Record<string, unknown> = {}) {
    await admin
      .from('ml_listings')
      .update({ last_push_status: 'skipped', last_push_error: reason, last_pushed_at: now(), ...extra })
      .in(
        'id',
        targets.map((t) => t.id),
      )
    summary.skipped += targets.length
    for (const t of targets) logs.push({ ...base(t), status: 'skipped', message: `${name(t)}: ${reason}` })
  }

  async function markFailed(targets: LinkedListing[], reason: string) {
    await admin
      .from('ml_listings')
      .update({ last_push_status: 'error', last_push_error: reason, last_pushed_at: now() })
      .in(
        'id',
        targets.map((t) => t.id),
      )
    summary.failed += targets.length
    for (const t of targets) logs.push({ ...base(t), status: 'error', message: `Não foi possível enviar o estoque de ${name(t)}: ${reason}` })
  }

  // Um anúncio por vez: evita conflito de versão no Mercado Livre e respeita o limite de requisições.
  for (const [itemId, group] of byItem) {
    const targets = group.filter((l) => !l.is_full)
    if (targets.length < group.length)
      await markSkipped(
        group.filter((l) => l.is_full),
        'anúncio no Full — o estoque é controlado pelo Mercado Livre.',
      )
    if (!targets.length) continue
    // Anúncios deste item que ainda não tiveram resultado registrado.
    let remaining = targets
    try {
      const item = await mlRequest<MlItemStock>(`/items/${itemId}`, { token, query: { attributes: 'id,status,available_quantity,variations,shipping' } })
      if (item.shipping?.logistic_type === 'fulfillment') {
        await markSkipped(targets, 'anúncio no Full — o estoque é controlado pelo Mercado Livre.', { is_full: true })
        continue
      }
      if (item.status === 'closed') {
        await markSkipped(targets, 'anúncio finalizado no Mercado Livre.', { status: 'closed' })
        continue
      }

      // Vínculo que não aponta mais para um item com estoque (ex.: o produto ganhou
      // variações depois de vinculado): nunca envia 0 por engano.
      const stale = targets.filter((t) => !quantities.has(stockKey(t.product_id, t.variant_id)))
      if (stale.length) await markFailed(stale, 'o vínculo está desatualizado (o produto pode ter ganhado variações). Refaça o vínculo do anúncio.')
      const valid = targets.filter((t) => quantities.has(stockKey(t.product_id, t.variant_id)))
      remaining = valid
      if (!valid.length) continue
      const desired = new Map(valid.map((t) => [t.ml_variation_id, quantities.get(stockKey(t.product_id, t.variant_id))!]))
      const changed = valid.filter((t) => quantityIn(item, t.ml_variation_id) !== desired.get(t.ml_variation_id))
      if (!changed.length) {
        await admin
          .from('ml_listings')
          .update({ last_push_status: 'success', last_push_error: null, last_pushed_at: now(), ml_checked_at: now() })
          .in(
            'id',
            valid.map((t) => t.id),
          )
        summary.unchanged += valid.length
        continue
      }

      const update = buildStockUpdate(item, desired)
      if ('error' in update) {
        await markFailed(valid, update.error)
        continue
      }
      const result = await mlRequest<MlItemStock>(`/items/${itemId}`, { method: 'PUT', token, body: update.body })
      remaining = []

      for (const t of valid) {
        const wanted = desired.get(t.ml_variation_id)!
        const before = quantityIn(item, t.ml_variation_id)
        const after = quantityIn(result, t.ml_variation_id)
        if (after !== undefined && after !== wanted) {
          // Respondeu OK mas não aplicou (ex.: conta com estoque por depósito/multiorigem).
          await markFailed([t], `o Mercado Livre manteve ${after} un. em vez de ${wanted}. Se sua conta usa estoque por depósito, atualize pelo Mercado Livre.`)
          continue
        }
        await admin
          .from('ml_listings')
          .update({
            last_pushed_quantity: wanted,
            last_pushed_at: now(),
            last_push_status: 'success',
            last_push_error: null,
            ml_available_quantity: wanted,
            ml_checked_at: now(),
          })
          .eq('id', t.id)
        summary.pushed++
        logs.push({ ...base(t), status: 'success', message: `${name(t)}: estoque enviado (${before ?? '?'} → ${wanted} un.).` })
      }
    } catch (err) {
      if (err instanceof MlApiError && err.retryable) summary.retryable = true
      if (remaining.length) await markFailed(remaining, errorText(err))
    }
  }

  await writeSyncLog(admin, logs)
  logInfo('ml.push_done', { user_id: userId, ...summary })
  return summary
}

/** Atualiza o resumo da última sincronização na conexão. */
export async function recordSyncResult(admin: Admin, userId: string, summary: PushSummary) {
  const status = summary.failed === 0 ? 'success' : summary.pushed + summary.unchanged > 0 ? 'partial' : 'error'
  await admin.from('ml_connections').update({ last_sync_at: new Date().toISOString(), last_sync_status: status }).eq('user_id', userId)
}
