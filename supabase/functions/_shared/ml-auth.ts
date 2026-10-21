// Tokens do Mercado Livre: troca do código, renovação automática (com trava,
// porque o refresh token é de uso único) e marcação de "reconectar".
import { decryptSecret, encryptSecret } from './crypto.ts'
import { requireEnv } from './env.ts'
import { HttpError } from './http.ts'
import { logError, logInfo } from './log.ts'
import { MlApiError, mlRequest } from './ml-api.ts'
import type { Admin } from './supabase.ts'
import { writeSyncLog } from './sync-log.ts'

export interface MlTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
  user_id: number
  refresh_token: string
}

export interface MlConnectionRow {
  user_id: string
  seller_id: number
  nickname: string | null
  access_token_enc: string
  refresh_token_enc: string
  token_expires_at: string
  status: 'active' | 'reconnect_required'
  sync_mode: 'manual' | 'automatic'
  refresh_lock_until: string | null
}

/** A conexão precisa ser refeita pelo usuário (token revogado ou vencido). */
export class ReconnectRequiredError extends HttpError {
  constructor() {
    super(409, 'A conexão com o Mercado Livre expirou. Clique em "Reconectar" na página Mercado Livre.')
  }
}

function tokenForm(extra: Record<string, string>) {
  return { client_id: requireEnv('ML_CLIENT_ID'), client_secret: requireEnv('ML_CLIENT_SECRET'), ...extra }
}

export function exchangeCode(code: string, redirectUri: string, codeVerifier: string | null) {
  return mlRequest<MlTokenResponse>('/oauth/token', {
    method: 'POST',
    retries: 1,
    form: tokenForm({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, ...(codeVerifier ? { code_verifier: codeVerifier } : {}) }),
  })
}

function refreshRequest(refreshToken: string) {
  return mlRequest<MlTokenResponse>('/oauth/token', {
    method: 'POST',
    retries: 2,
    form: tokenForm({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
}

export async function encryptTokens(tokens: MlTokenResponse) {
  return {
    access_token_enc: await encryptSecret(tokens.access_token),
    refresh_token_enc: await encryptSecret(tokens.refresh_token),
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scope: tokens.scope ?? null,
  }
}

export async function loadConnection(admin: Admin, userId: string): Promise<MlConnectionRow | null> {
  const { data, error } = await admin.from('ml_connections').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as MlConnectionRow | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const validFor = (conn: MlConnectionRow, minutes: number) => new Date(conn.token_expires_at).getTime() > Date.now() + minutes * 60_000

/**
 * Devolve um access token válido por pelo menos `minValidityMinutes`,
 * renovando quando necessário.
 */
export async function getAccessToken(admin: Admin, userId: string, minValidityMinutes = 10): Promise<{ token: string; connection: MlConnectionRow }> {
  let conn = await loadConnection(admin, userId)
  if (!conn) throw new HttpError(404, 'Conecte sua conta do Mercado Livre primeiro.')

  for (let attempt = 0; attempt < 6; attempt++) {
    if (conn.status === 'reconnect_required') throw new ReconnectRequiredError()
    if (validFor(conn, minValidityMinutes)) return { token: await decryptSecret(conn.access_token_enc), connection: conn }

    // Tenta pegar a trava de renovação por 30 segundos.
    const now = new Date().toISOString()
    const { data: claimed, error } = await admin
      .from('ml_connections')
      .update({ refresh_lock_until: new Date(Date.now() + 30_000).toISOString() })
      .eq('user_id', userId)
      .or(`refresh_lock_until.is.null,refresh_lock_until.lt.${now}`)
      .select('*')
      .maybeSingle()
    if (error) throw error

    if (!claimed) {
      // Outra execução está renovando: espera e lê de novo.
      await sleep(2000)
      conn = (await loadConnection(admin, userId))!
      continue
    }
    return { token: await refreshWithLock(admin, claimed as MlConnectionRow), connection: conn }
  }
  throw new HttpError(503, 'O Mercado Livre está demorando para responder. Tente de novo em instantes.')
}

async function refreshWithLock(admin: Admin, conn: MlConnectionRow): Promise<string> {
  try {
    const tokens = await refreshRequest(await decryptSecret(conn.refresh_token_enc))
    const encrypted = await encryptTokens(tokens)
    const { error } = await admin
      .from('ml_connections')
      .update({ ...encrypted, status: 'active', last_error: null, last_refresh_at: new Date().toISOString(), refresh_lock_until: null })
      .eq('user_id', conn.user_id)
    if (error) throw error
    logInfo('ml.token_refreshed', { user_id: conn.user_id, expires_at: encrypted.token_expires_at })
    return tokens.access_token
  } catch (err) {
    // invalid_grant = refresh token vencido, revogado ou já usado.
    const revoked = err instanceof MlApiError && err.code === 'invalid_grant'
    if (revoked) {
      // Se outra execução já trocou o refresh token, usa o novo.
      const fresh = await loadConnection(admin, conn.user_id)
      if (fresh && fresh.refresh_token_enc !== conn.refresh_token_enc && validFor(fresh, 1)) {
        await admin.from('ml_connections').update({ refresh_lock_until: null }).eq('user_id', conn.user_id)
        return decryptSecret(fresh.access_token_enc)
      }
      await admin
        .from('ml_connections')
        .update({ status: 'reconnect_required', last_error: 'A autorização foi revogada ou expirou. Reconecte a conta.', refresh_lock_until: null })
        .eq('user_id', conn.user_id)
      await writeSyncLog(admin, {
        user_id: conn.user_id,
        kind: 'token_refresh',
        status: 'error',
        message: 'Não foi possível renovar o acesso ao Mercado Livre. Reconecte sua conta.',
        details: { status: err.status, code: err.code },
      })
      logError('ml.token_refresh_revoked', err, { user_id: conn.user_id })
      throw new ReconnectRequiredError()
    }
    // Erro temporário: libera a trava para tentar de novo depois.
    await admin.from('ml_connections').update({ refresh_lock_until: null, last_error: 'Falha temporária ao renovar o acesso.' }).eq('user_id', conn.user_id)
    logError('ml.token_refresh_failed', err, { user_id: conn.user_id })
    throw err
  }
}
