// Processamento da fila ml_events: vendas (orders_v2), anúncios (items) e
// envio de estoque (stock_push). Cada evento é independente: um com erro não
// trava os outros. Erros temporários voltam para a fila com espera crescente.
import { HttpError } from './http.ts'
import { errorText, logError, logInfo } from './log.ts'
import { listingRows, type MlItem } from './listings.ts'
import { MlApiError, mlRequest } from './ml-api.ts'
import { getAccessToken, loadConnection, ReconnectRequiredError, type MlConnectionRow } from './ml-auth.ts'
import { LISTING_COLUMNS, pushListings, recordSyncResult, type LinkedListing } from './stock-push.ts'
import type { Admin } from './supabase.ts'
import { writeSyncLog, type SyncLogEntry } from './sync-log.ts'

export const MAX_ATTEMPTS = 8

export interface MlEvent {
  id: string
  user_id: string | null
  source: 'webhook' | 'system'
  topic: string
  resource: string
  attempts: number
  payload: Record<string, unknown> | null
}

/** Erro definitivo: não adianta tentar de novo. */
class PermanentError extends Error {}

/** Resultado de um evento que terminou sem erro. */
type Outcome = { status: 'processed' | 'ignored'; note?: string }

/** Espera antes da próxima tentativa: 1, 2, 4, 8… minutos (máx. 60). */
export function retryDelayMinutes(attempts: number) {
  return Math.min(2 ** Math.max(attempts - 1, 0), 60)
}

/** Decide o que fazer com um evento que falhou. */
export function failureDecision(err: unknown, attempts: number): { status: 'pending' | 'error'; message: string } {
  const message = errorText(err)
  const permanent =
    err instanceof PermanentError ||
    err instanceof ReconnectRequiredError ||
    (err instanceof MlApiError && !err.retryable) ||
    (err instanceof HttpError && err.status < 500)
  if (!permanent && attempts < MAX_ATTEMPTS) return { status: 'pending', message }
  return { status: 'error', message }
}

const SALE_STATUSES = ['paid', 'partially_paid', 'partially_refunded']

interface MlOrder {
  id: number
  status: string
  seller?: { id: number }
  shipping?: { id?: number | null } | null
  order_items: { item: { id: string; title?: string; variation_id?: number | null }; quantity: number }[]
}

/** A entrega é pelo Full? (null = não deu para saber) */
async function shipmentIsFull(order: MlOrder, token: string): Promise<boolean | null> {
  if (!order.shipping?.id) return null
  try {
    const shipment = await mlRequest<{ logistic_type?: string }>(`/shipments/${order.shipping.id}`, { token, headers: { 'x-format-new': 'true' }, retries: 1 })
    return shipment.logistic_type ? shipment.logistic_type === 'fulfillment' : null
  } catch {
    return null
  }
}

async function handleOrder(admin: Admin, event: MlEvent, conn: MlConnectionRow, token: string): Promise<Outcome> {
  const orderId = event.resource.match(/^\/orders\/(\d+)$/)?.[1]
  if (!orderId) return { status: 'ignored', note: 'Recurso inválido' }
  const order = await mlRequest<MlOrder>(`/orders/${orderId}`, { token })
  if (order.seller?.id && Number(order.seller.id) !== Number(conn.seller_id)) throw new PermanentError('O pedido é de outro vendedor')

  const isCancel = order.status === 'cancelled'
  if (!isCancel && !SALE_STATUSES.includes(order.status)) return { status: 'processed', note: `Pedido com status "${order.status}": nada a fazer por enquanto` }

  const full = isCancel ? false : await shipmentIsFull(order, token)
  const logs: SyncLogEntry[] = []
  for (const line of order.order_items ?? []) {
    const variationId = line.item.variation_id ?? 0
    let isFull = full
    if (isFull == null) {
      const { data } = await admin
        .from('ml_listings')
        .select('is_full')
        .eq('user_id', conn.user_id)
        .eq('ml_item_id', line.item.id)
        .eq('ml_variation_id', variationId)
        .maybeSingle()
      isFull = Boolean(data?.is_full)
    }
    const { data, error } = await admin.rpc('apply_ml_order_item', {
      p_user_id: conn.user_id,
      p_order_id: Number(order.id),
      p_item_id: line.item.id,
      p_variation_id: variationId,
      p_quantity: line.quantity,
      p_order_status: order.status,
      p_is_full: isFull,
    })
    if (error) throw error
    const result = (data as { result: string; product_id?: string; variant_id?: string; balance_after?: number }).result
    const title = line.item.title ?? line.item.id
    const base = {
      user_id: conn.user_id,
      kind: 'sale' as const,
      ml_item_id: line.item.id,
      ml_variation_id: variationId || null,
      product_id: (data as { product_id?: string }).product_id ?? null,
      variant_id: (data as { variant_id?: string }).variant_id ?? null,
      event_id: event.id,
    }
    if (result === 'applied') {
      const balance = (data as { balance_after?: number }).balance_after
      logs.push({
        ...base,
        status: 'success',
        message: `Venda no pedido ${order.id}: baixa de ${line.quantity} un. de ${title}.${balance != null && balance < 0 ? ` Atenção: o estoque ficou negativo (${balance}).` : ''}`,
      })
    } else if (result === 'cancelled') {
      logs.push({ ...base, status: 'success', message: `Pedido ${order.id} cancelado: ${line.quantity} un. de ${title} voltaram ao estoque.` })
    } else if (result === 'skipped_full') {
      logs.push({ ...base, status: 'skipped', message: `Venda no Full (pedido ${order.id}) de ${title}: o estoque do Full é controlado pelo Mercado Livre.` })
    } else if (result === 'unlinked') {
      logs.push({
        ...base,
        status: 'info',
        message: `Venda no pedido ${order.id} de ${title}, mas o anúncio não está vinculado a um produto: o estoque não foi baixado.`,
      })
    }
  }
  await writeSyncLog(admin, logs)
  return { status: 'processed' }
}

async function handleItem(admin: Admin, event: MlEvent, conn: MlConnectionRow, token: string): Promise<Outcome> {
  const itemId = event.resource.match(/^\/items\/(MLB\d+)$/)?.[1]
  if (!itemId) return { status: 'ignored', note: 'Recurso inválido' }
  const item = await mlRequest<MlItem & { seller_id?: number }>(`/items/${itemId}`, { token, query: { include_attributes: 'all' } })
  if (item.seller_id && Number(item.seller_id) !== Number(conn.seller_id)) throw new PermanentError('O anúncio é de outro vendedor')
  const rows = listingRows(item, conn.user_id, new Date().toISOString())
  const { error } = await admin.from('ml_listings').upsert(rows, { onConflict: 'user_id,ml_item_id,ml_variation_id' })
  if (error) throw error
  await admin.rpc('suggest_ml_links', { p_user_id: conn.user_id })
  return { status: 'processed' }
}

async function handleStockPush(admin: Admin, event: MlEvent, conn: MlConnectionRow, token: string): Promise<Outcome> {
  const [, productId, variant] = event.resource.split(':')
  if (conn.sync_mode !== 'automatic') return { status: 'processed', note: 'Sincronização automática desligada' }
  let query = admin
    .from('ml_listings')
    .select(LISTING_COLUMNS)
    .eq('user_id', conn.user_id)
    .eq('link_status', 'linked')
    .eq('is_full', false)
    .eq('product_id', productId)
  query = variant && variant !== '0' ? query.eq('variant_id', variant) : query.is('variant_id', null)
  const { data, error } = await query
  if (error) throw error
  if (!data?.length) return { status: 'processed', note: 'Nenhum anúncio vinculado' }
  const summary = await pushListings(admin, conn.user_id, token, data as LinkedListing[], event.id)
  await recordSyncResult(admin, conn.user_id, summary)
  if (summary.failed && summary.retryable) throw new MlApiError(503, 'Mercado Livre indisponível; nova tentativa em instantes')
  return { status: 'processed' }
}

async function finish(admin: Admin, event: MlEvent, outcome: Outcome) {
  await admin
    .from('ml_events')
    .update({ status: outcome.status, processed_at: new Date().toISOString(), locked_until: null, last_error: outcome.note ?? null })
    .eq('id', event.id)
}

async function fail(admin: Admin, event: MlEvent, err: unknown) {
  const decision = failureDecision(err, event.attempts)
  const next = new Date(Date.now() + retryDelayMinutes(event.attempts) * 60_000).toISOString()
  await admin
    .from('ml_events')
    .update({
      status: decision.status,
      last_error: decision.message.slice(0, 500),
      locked_until: null,
      ...(decision.status === 'pending' ? { next_attempt_at: next } : {}),
    })
    .eq('id', event.id)
  if (decision.status === 'error' && event.user_id) {
    const what =
      event.topic === 'orders_v2'
        ? `a venda ${event.resource.replace('/orders/', 'do pedido ')}`
        : event.topic === 'stock_push'
          ? 'o envio de estoque'
          : `a atualização de ${event.resource}`
    await writeSyncLog(admin, {
      user_id: event.user_id,
      kind: event.topic === 'orders_v2' ? 'sale' : event.topic === 'stock_push' ? 'push_stock' : 'item_update',
      status: 'error',
      message: `Não foi possível processar ${what}: ${decision.message}. Use "Reprocessar" na aba Sincronização.`,
      event_id: event.id,
    })
  }
  logError('ml.event_failed', err, { event_id: event.id, topic: event.topic, attempts: event.attempts, decision: decision.status })
}

export interface QueueResult {
  claimed: number
  processed: number
  failed: number
}

/** Processa a fila (de todos os usuários ou de um só) dentro do tempo disponível. */
export async function processQueue(
  admin: Admin,
  { userId = null, limit = 20, budgetMs = 45_000 }: { userId?: string | null; limit?: number; budgetMs?: number } = {},
): Promise<QueueResult> {
  const started = Date.now()
  const { data, error } = await admin.rpc('claim_ml_events', { p_limit: limit, p_user_id: userId })
  if (error) throw error
  const events = (data ?? []) as MlEvent[]
  const result: QueueResult = { claimed: events.length, processed: 0, failed: 0 }
  const sessions = new Map<string, { conn: MlConnectionRow; token: string } | Error>()

  for (const event of events) {
    if (Date.now() - started > budgetMs) {
      // Sem tempo: devolve para a próxima rodada sem contar tentativa.
      await admin
        .from('ml_events')
        .update({ status: 'pending', attempts: event.attempts - 1, locked_until: null })
        .eq('id', event.id)
      continue
    }
    try {
      if (!event.user_id) {
        await finish(admin, event, { status: 'ignored', note: 'Vendedor não conectado' })
        continue
      }
      if (!sessions.has(event.user_id)) {
        const conn = await loadConnection(admin, event.user_id)
        if (!conn) sessions.set(event.user_id, new PermanentError('Conta do Mercado Livre desconectada'))
        else {
          try {
            sessions.set(event.user_id, { conn, token: (await getAccessToken(admin, event.user_id)).token })
          } catch (err) {
            sessions.set(event.user_id, err instanceof Error ? err : new Error(String(err)))
          }
        }
      }
      const session = sessions.get(event.user_id)!
      if (session instanceof Error) throw session

      const outcome =
        event.topic === 'orders_v2'
          ? await handleOrder(admin, event, session.conn, session.token)
          : event.topic === 'items'
            ? await handleItem(admin, event, session.conn, session.token)
            : event.topic === 'stock_push'
              ? await handleStockPush(admin, event, session.conn, session.token)
              : { status: 'ignored' as const, note: 'Tópico não tratado' }
      await finish(admin, event, outcome)
      result.processed++
    } catch (err) {
      await fail(admin, event, err)
      result.failed++
    }
  }
  if (events.length) logInfo('ml.queue_done', { ...result, user_id: userId })
  return result
}
