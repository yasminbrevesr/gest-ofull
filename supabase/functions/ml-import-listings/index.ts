// Importa os anúncios do vendedor (com paginação) e sugere o vínculo com o
// estoque pelo SKU. Um anúncio com erro não impede os demais.
import { HttpError, json, serve } from '../_shared/http.ts'
import { errorText, logError, logInfo } from '../_shared/log.ts'
import { listingKey, listingRows, type ListingRow, type MlItem } from '../_shared/listings.ts'
import { chunk, mapLimit, mlRequest } from '../_shared/ml-api.ts'
import { getAccessToken } from '../_shared/ml-auth.ts'
import { adminClient, requireUser, type Admin } from '../_shared/supabase.ts'
import { writeSyncLog } from '../_shared/sync-log.ts'

const MAX_ITEMS = 5000

interface SearchResponse {
  results: string[]
  scroll_id?: string
  paging?: { total: number }
}

/** Lista os ids dos anúncios. O modo "scan" permite passar de 1.000 anúncios. */
async function listItemIds(token: string, sellerId: number): Promise<string[]> {
  const ids: string[] = []
  let scrollId: string | undefined
  for (let page = 0; page < 100 && ids.length < MAX_ITEMS; page++) {
    const res = await mlRequest<SearchResponse>(`/users/${sellerId}/items/search`, {
      token,
      query: { search_type: 'scan', limit: 100, scroll_id: scrollId },
    })
    if (!res.results?.length) break
    ids.push(...res.results)
    scrollId = res.scroll_id
    if (!scrollId) break
  }
  return [...new Set(ids)].slice(0, MAX_ITEMS)
}

/** Remove variações que não existem mais nos anúncios importados. */
async function removeStaleVariations(admin: Admin, userId: string, rows: ListingRow[]) {
  const keep = new Set(rows.map((r) => listingKey(r.ml_item_id, r.ml_variation_id)))
  const itemIds = [...new Set(rows.map((r) => r.ml_item_id))]
  let removed = 0
  for (const ids of chunk(itemIds, 200)) {
    const { data, error } = await admin.from('ml_listings').select('id, ml_item_id, ml_variation_id').eq('user_id', userId).in('ml_item_id', ids)
    if (error) throw error
    const stale = (data ?? []).filter((r) => !keep.has(listingKey(r.ml_item_id, r.ml_variation_id))).map((r) => r.id)
    if (stale.length) {
      const { error: delError } = await admin.from('ml_listings').delete().in('id', stale)
      if (delError) throw delError
      removed += stale.length
    }
  }
  return removed
}

serve('ml-import-listings', async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const { token, connection } = await getAccessToken(admin, user.id)
  const startedAt = new Date().toISOString()

  let ids: string[]
  try {
    ids = await listItemIds(token, connection.seller_id)
  } catch (err) {
    logError('ml.import_search_failed', err, { user_id: user.id })
    await writeSyncLog(admin, {
      user_id: user.id,
      kind: 'import',
      status: 'error',
      message: 'Não foi possível listar seus anúncios no Mercado Livre.',
      details: { error: errorText(err) },
    })
    throw new HttpError(502, 'Não foi possível listar seus anúncios no Mercado Livre. Tente de novo em instantes.')
  }

  // Detalhes em lotes de 20 (limite do multiget), 3 lotes por vez.
  const rows: ListingRow[] = []
  const failures: { id: string; error: string }[] = []
  await mapLimit(chunk(ids, 20), 3, async (batch) => {
    try {
      const res = await mlRequest<{ code: number; body: MlItem & { message?: string } }[]>('/items', {
        token,
        query: { ids: batch.join(','), include_attributes: 'all' },
      })
      for (const entry of res) {
        if (entry.code === 200) rows.push(...listingRows(entry.body, user.id, startedAt))
        else failures.push({ id: entry.body?.id ?? '?', error: entry.body?.message ?? `código ${entry.code}` })
      }
    } catch (err) {
      for (const id of batch) failures.push({ id, error: errorText(err) })
    }
  })

  for (const part of chunk(rows, 200)) {
    const { error } = await admin.from('ml_listings').upsert(part, { onConflict: 'user_id,ml_item_id,ml_variation_id' })
    if (error) throw error
  }
  const removed = await removeStaleVariations(admin, user.id, rows)
  const { data: suggested, error: suggestError } = await admin.rpc('suggest_ml_links', { p_user_id: user.id })
  if (suggestError) throw suggestError

  await admin.from('ml_connections').update({ last_import_at: new Date().toISOString() }).eq('user_id', user.id)
  const summary = { items: ids.length, listings: rows.length, suggested: suggested ?? 0, removed, failed: failures.length, truncated: ids.length >= MAX_ITEMS }
  await writeSyncLog(admin, {
    user_id: user.id,
    kind: 'import',
    status: failures.length ? (rows.length ? 'info' : 'error') : 'success',
    message: `${ids.length} anúncio(s) importado(s), ${suggested ?? 0} vínculo(s) sugerido(s)${failures.length ? `, ${failures.length} com erro` : ''}.`,
    details: { ...summary, failures: failures.slice(0, 20) },
  })
  logInfo('ml.import_done', { user_id: user.id, ...summary })
  return json(summary)
})
