// Conferência (agendada a cada hora, ou pelo botão "Conferir agora"): lê a
// quantidade atual dos anúncios vinculados no Mercado Livre e conta as
// divergências com o estoque do sistema. Não altera nada: o usuário decide.
import { json, serve } from '../_shared/http.ts'
import { errorText, logError, logInfo } from '../_shared/log.ts'
import { chunk, mapLimit, mlRequest } from '../_shared/ml-api.ts'
import { getAccessToken } from '../_shared/ml-auth.ts'
import { adminClient, requireUserOrCron, type Admin } from '../_shared/supabase.ts'
import { writeSyncLog } from '../_shared/sync-log.ts'

interface ItemStock {
  id: string
  status?: string
  available_quantity?: number
  shipping?: { logistic_type?: string | null } | null
  variations?: { id: number; available_quantity?: number }[]
}

async function reconcileUser(admin: Admin, userId: string, previousCount: number) {
  const { token } = await getAccessToken(admin, userId)
  const { data: listings, error } = await admin.from('ml_listings').select('id, ml_item_id, ml_variation_id').eq('user_id', userId).eq('link_status', 'linked')
  if (error) throw error
  const itemIds = [...new Set((listings ?? []).map((l) => l.ml_item_id))]
  const checkedAt = new Date().toISOString()
  let failures = 0

  await mapLimit(chunk(itemIds, 20), 2, async (ids) => {
    try {
      const res = await mlRequest<{ code: number; body: ItemStock }[]>('/items', {
        token,
        query: { ids: ids.join(','), attributes: 'id,status,available_quantity,variations,shipping' },
      })
      for (const { code, body } of res) {
        if (code !== 200) {
          failures++
          continue
        }
        for (const l of (listings ?? []).filter((x) => x.ml_item_id === body.id)) {
          const qty = l.ml_variation_id ? body.variations?.find((v) => v.id === Number(l.ml_variation_id))?.available_quantity : body.available_quantity
          await admin
            .from('ml_listings')
            .update({
              ml_available_quantity: qty ?? null,
              status: body.status ?? null,
              is_full: body.shipping?.logistic_type === 'fulfillment',
              ml_checked_at: checkedAt,
            })
            .eq('id', l.id)
        }
      }
    } catch (err) {
      failures += ids.length
      logError('ml.reconcile_batch_failed', err, { user_id: userId })
    }
  })

  const { count, error: countError } = await admin.from('ml_stock_divergences').select('listing_id', { count: 'exact', head: true }).eq('user_id', userId)
  if (countError) throw countError
  const divergences = count ?? 0
  await admin.from('ml_connections').update({ divergence_count: divergences, last_reconcile_at: checkedAt }).eq('user_id', userId)

  // Só registra quando a situação muda (evita uma linha igual por hora).
  if (divergences !== previousCount) {
    await writeSyncLog(admin, {
      user_id: userId,
      kind: 'reconcile',
      status: divergences ? 'info' : 'success',
      message: divergences
        ? `${divergences} anúncio(s) com quantidade diferente do estoque do sistema. Confira em Mercado Livre → Sincronização.`
        : 'Conferência: o estoque dos anúncios vinculados está igual ao do sistema.',
    })
  }
  return { listings: listings?.length ?? 0, divergences, failures }
}

serve('ml-reconcile', async (req) => {
  const admin = adminClient()
  const { userId } = await requireUserOrCron(req, admin)
  let query = admin.from('ml_connections').select('user_id, divergence_count').eq('status', 'active')
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw error

  const results: Record<string, unknown>[] = []
  // Uma conta com problema não impede a conferência das outras.
  for (const conn of data ?? []) {
    try {
      results.push({ user_id: conn.user_id, ...(await reconcileUser(admin, conn.user_id, conn.divergence_count)) })
    } catch (err) {
      results.push({ user_id: conn.user_id, error: errorText(err) })
      logError('ml.reconcile_failed', err, { user_id: conn.user_id })
    }
  }
  logInfo('ml.reconcile_done', { accounts: results.length })
  return json(userId ? (results[0] ?? { listings: 0, divergences: 0, failures: 0 }) : { accounts: results.length })
})
