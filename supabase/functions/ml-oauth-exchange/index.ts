// Volta do Mercado Livre: confere o "state", troca o código por tokens,
// confere a conta (Brasil) e salva a conexão com os tokens criptografados.
import { sha256Hex } from '../_shared/crypto.ts'
import { HttpError, json, readJson, serve } from '../_shared/http.ts'
import { logError, logInfo } from '../_shared/log.ts'
import { MlApiError, mlRequest } from '../_shared/ml-api.ts'
import { encryptTokens, exchangeCode } from '../_shared/ml-auth.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { writeSyncLog } from '../_shared/sync-log.ts'

interface MlUser {
  id: number
  nickname: string
  site_id: string
}

serve('ml-oauth-exchange', async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const { code, state } = await readJson<{ code?: string; state?: string }>(req)
  if (typeof code !== 'string' || typeof state !== 'string' || !code || !state) throw new HttpError(400, 'Link de retorno incompleto. Tente conectar de novo.')

  // O "state" é de uso único: apaga antes de usar.
  const { data: stored, error: stateError } = await admin
    .from('ml_oauth_states')
    .delete()
    .eq('state_hash', await sha256Hex(state))
    .select('*')
    .maybeSingle()
  if (stateError) throw stateError
  if (!stored || stored.user_id !== user.id) throw new HttpError(400, 'Este link de conexão não é válido (ou já foi usado). Clique em "Conectar" de novo.')
  if (new Date(stored.expires_at).getTime() < Date.now()) throw new HttpError(400, 'O tempo para concluir a conexão acabou. Clique em "Conectar" de novo.')

  let tokens
  try {
    tokens = await exchangeCode(code, stored.redirect_uri, stored.code_verifier)
  } catch (err) {
    logError('ml.oauth_exchange_failed', err, { user_id: user.id })
    if (err instanceof MlApiError && err.status < 500) {
      throw new HttpError(400, 'O Mercado Livre não aceitou a autorização. Clique em "Conectar" de novo. Se continuar, avise o suporte.')
    }
    throw new HttpError(502, 'O Mercado Livre não respondeu. Tente de novo em instantes.')
  }

  const me = await mlRequest<MlUser>('/users/me', { token: tokens.access_token })
  if (me.site_id !== 'MLB') throw new HttpError(400, 'Esta conta não é do Mercado Livre Brasil. O app funciona apenas com contas brasileiras.')

  const { data: owner } = await admin.from('ml_connections').select('user_id').eq('seller_id', me.id).maybeSingle()
  if (owner && owner.user_id !== user.id) throw new HttpError(409, 'Esta conta do Mercado Livre já está conectada a outro usuário do app.')

  // Trocou de conta do Mercado Livre: os anúncios importados da conta antiga não valem mais.
  const { data: previous } = await admin.from('ml_connections').select('seller_id').eq('user_id', user.id).maybeSingle()
  if (previous && Number(previous.seller_id) !== me.id) {
    await admin.from('ml_listings').delete().eq('user_id', user.id)
  }

  const now = new Date().toISOString()
  const { error } = await admin.from('ml_connections').upsert({
    user_id: user.id,
    seller_id: me.id,
    nickname: me.nickname,
    site_id: me.site_id,
    ...(await encryptTokens(tokens)),
    status: 'active',
    last_error: null,
    refresh_lock_until: null,
    last_refresh_at: now,
    connected_at: now,
  })
  if (error) throw error

  await writeSyncLog(admin, { user_id: user.id, kind: 'connection', status: 'success', message: `Conta ${me.nickname} conectada.` })
  logInfo('ml.connected', { user_id: user.id, seller_id: me.id })
  return json({ nickname: me.nickname })
})
