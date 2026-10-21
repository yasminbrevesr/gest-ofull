// "Enviar estoque agora": envia o saldo do sistema para os anúncios vinculados
// (todos, ou só os escolhidos). Anúncios no Full são pulados.
import { HttpError, json, readJson, serve } from '../_shared/http.ts'
import { getAccessToken } from '../_shared/ml-auth.ts'
import { LISTING_COLUMNS, pushListings, recordSyncResult, type LinkedListing } from '../_shared/stock-push.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

serve('ml-push-stock', async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const { listingIds } = await readJson<{ listingIds?: unknown }>(req)
  if (listingIds !== undefined && (!Array.isArray(listingIds) || listingIds.some((id) => typeof id !== 'string') || listingIds.length > 500)) {
    throw new HttpError(400, 'Lista de anúncios inválida')
  }

  const { token } = await getAccessToken(admin, user.id)
  let query = admin.from('ml_listings').select(LISTING_COLUMNS).eq('user_id', user.id).eq('link_status', 'linked')
  if (listingIds?.length) query = query.in('id', listingIds as string[])
  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new HttpError(400, 'Nenhum anúncio vinculado para enviar. Vincule os anúncios aos produtos primeiro.')

  const summary = await pushListings(admin, user.id, token, data as LinkedListing[])
  await recordSyncResult(admin, user.id, summary)
  return json(summary)
})
