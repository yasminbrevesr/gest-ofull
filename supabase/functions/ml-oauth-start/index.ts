// Inicia a conexão: gera o "state" (proteção contra falsificação) e o PKCE,
// guarda no banco e devolve o link de autorização do Mercado Livre.
import { pkceChallenge, randomToken, sha256Hex } from '../_shared/crypto.ts'
import { optionalEnv, requireEnv } from '../_shared/env.ts'
import { HttpError, json, serve } from '../_shared/http.ts'
import { logInfo } from '../_shared/log.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

serve('ml-oauth-start', async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const clientId = requireEnv('ML_CLIENT_ID')
  const redirectUri = requireEnv('ML_REDIRECT_URI')
  const usePkce = optionalEnv('ML_USE_PKCE', 'true') !== 'false'

  const state = randomToken(32)
  const verifier = usePkce ? randomToken(48) : null

  const { error } = await admin.from('ml_oauth_states').insert({
    state_hash: await sha256Hex(state),
    user_id: user.id,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  })
  if (error) throw new HttpError(500, 'Não foi possível iniciar a conexão. Tente de novo.')

  const url = new URL(optionalEnv('ML_AUTH_URL', 'https://auth.mercadolivre.com.br/authorization'))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  if (verifier) {
    url.searchParams.set('code_challenge', await pkceChallenge(verifier))
    url.searchParams.set('code_challenge_method', 'S256')
  }

  logInfo('ml.oauth_start', { user_id: user.id, pkce: usePkce })
  return json({ url: url.toString() })
})
