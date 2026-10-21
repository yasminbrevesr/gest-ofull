// Desconecta a conta: tenta revogar a autorização no Mercado Livre e apaga os
// tokens. Os vínculos dos anúncios ficam guardados para uma nova conexão.
import { decryptSecret } from '../_shared/crypto.ts'
import { requireEnv } from '../_shared/env.ts'
import { json, serve } from '../_shared/http.ts'
import { logError, logInfo } from '../_shared/log.ts'
import { mlRequest } from '../_shared/ml-api.ts'
import { loadConnection } from '../_shared/ml-auth.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { writeSyncLog } from '../_shared/sync-log.ts'

serve('ml-disconnect', async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const conn = await loadConnection(admin, user.id)
  if (!conn) return json({ ok: true })

  try {
    const token = await decryptSecret(conn.access_token_enc)
    await mlRequest(`/users/${conn.seller_id}/applications/${requireEnv('ML_CLIENT_ID')}`, { method: 'DELETE', token, retries: 0 })
  } catch (err) {
    // Sem problema: apagar os tokens já impede qualquer acesso.
    logError('ml.revoke_failed', err, { user_id: user.id })
  }

  const { error } = await admin.from('ml_connections').delete().eq('user_id', user.id)
  if (error) throw error
  await writeSyncLog(admin, { user_id: user.id, kind: 'connection', status: 'info', message: `Conta ${conn.nickname ?? conn.seller_id} desconectada.` })
  logInfo('ml.disconnected', { user_id: user.id })
  return json({ ok: true })
})
