// Agendado (a cada 30 min): renova os tokens que vencem na próxima hora.
import { json, serve } from '../_shared/http.ts'
import { errorText, logInfo } from '../_shared/log.ts'
import { getAccessToken } from '../_shared/ml-auth.ts'
import { adminClient, requireCron } from '../_shared/supabase.ts'

serve('ml-refresh-tokens', async (req) => {
  requireCron(req)
  const admin = adminClient()
  const limit = new Date(Date.now() + 60 * 60_000).toISOString()
  const { data, error } = await admin.from('ml_connections').select('user_id').eq('status', 'active').lt('token_expires_at', limit)
  if (error) throw error

  let refreshed = 0
  const failures: { user_id: string; error: string }[] = []
  // Uma conta com problema não impede as outras.
  for (const { user_id } of data ?? []) {
    try {
      await getAccessToken(admin, user_id, 60)
      refreshed++
    } catch (err) {
      failures.push({ user_id, error: errorText(err) })
    }
  }
  logInfo('ml.refresh_tokens_done', { due: data?.length ?? 0, refreshed, failures: failures.length })
  return json({ due: data?.length ?? 0, refreshed, failures })
})
