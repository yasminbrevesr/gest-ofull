import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { _resetKeyCache, decryptSecret, encryptSecret } from './crypto.ts'
import { getAccessToken, ReconnectRequiredError, type MlConnectionRow } from './ml-auth.ts'
import type { Admin } from './supabase.ts'

Deno.env.set('ML_TOKEN_ENCRYPTION_KEY', 'chave-de-teste-com-mais-de-trinta-e-dois-caracteres')
Deno.env.set('ML_CLIENT_ID', 'app')
Deno.env.set('ML_CLIENT_SECRET', 'segredo')
_resetKeyCache()

/** Banco falso com o mínimo usado por ml-auth (ml_connections e sync_logs). */
function fakeAdmin(row: MlConnectionRow) {
  const db = { row: { ...row } as Record<string, unknown>, logs: [] as unknown[] }
  const admin = {
    from(table: string) {
      let patch: Record<string, unknown> | null = null
      let lockFilter = false
      const builder = {
        select: () => builder,
        eq: () => builder,
        update(values: Record<string, unknown>) {
          patch = values
          return builder
        },
        or() {
          lockFilter = true
          return builder
        },
        insert(rows: unknown) {
          db.logs.push(rows)
          return Promise.resolve({ error: null })
        },
        maybeSingle: () => run(),
        then: (resolve: (v: unknown) => void) => resolve(run()),
      }
      function run() {
        if (table !== 'ml_connections') return { data: null, error: null }
        if (patch) {
          const lock = db.row.refresh_lock_until as string | null
          if (lockFilter && lock && new Date(lock).getTime() > Date.now()) return { data: null, error: null }
          Object.assign(db.row, patch)
        }
        return { data: { ...db.row }, error: null }
      }
      return builder
    },
  }
  return { admin: admin as unknown as Admin, db }
}

function fakeTokenEndpoint(reply: { status: number; body: unknown }) {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (() => {
    calls++
    return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status }))
  }) as typeof fetch
  return { calls: () => calls, restore: () => (globalThis.fetch = original) }
}

async function connection(over: Partial<MlConnectionRow> = {}): Promise<MlConnectionRow> {
  return {
    user_id: 'u1',
    seller_id: 1,
    nickname: 'LOJA',
    access_token_enc: await encryptSecret('ACCESS-ANTIGO'),
    refresh_token_enc: await encryptSecret('REFRESH-ANTIGO'),
    token_expires_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
    status: 'active',
    sync_mode: 'manual',
    refresh_lock_until: null,
    ...over,
  }
}

Deno.test('token ainda válido é usado sem renovar', async () => {
  const { admin } = fakeAdmin(await connection())
  const f = fakeTokenEndpoint({ status: 500, body: {} })
  try {
    assertEquals((await getAccessToken(admin, 'u1')).token, 'ACCESS-ANTIGO')
    assertEquals(f.calls(), 0)
  } finally {
    f.restore()
  }
})

Deno.test('token vencendo é renovado e o novo refresh token é guardado criptografado', async () => {
  const { admin, db } = fakeAdmin(await connection({ token_expires_at: new Date(Date.now() + 60_000).toISOString() }))
  const f = fakeTokenEndpoint({
    status: 200,
    body: { access_token: 'ACCESS-NOVO', refresh_token: 'REFRESH-NOVO', expires_in: 21600, user_id: 1, token_type: 'bearer' },
  })
  try {
    assertEquals((await getAccessToken(admin, 'u1')).token, 'ACCESS-NOVO')
    assertEquals(await decryptSecret(db.row.refresh_token_enc as string), 'REFRESH-NOVO')
    assertEquals(db.row.refresh_lock_until, null)
    assertEquals(db.row.status, 'active')
  } finally {
    f.restore()
  }
})

Deno.test('refresh token revogado marca "reconectar" e avisa no log', async () => {
  const { admin, db } = fakeAdmin(await connection({ token_expires_at: new Date(Date.now() - 1000).toISOString() }))
  const f = fakeTokenEndpoint({ status: 400, body: { error: 'invalid_grant', error_description: 'expired' } })
  try {
    await assertRejects(() => getAccessToken(admin, 'u1'), ReconnectRequiredError)
    assertEquals(db.row.status, 'reconnect_required')
    assertEquals(db.logs.length, 1)
  } finally {
    f.restore()
  }
})

Deno.test('conexão marcada para reconectar não chama a API', async () => {
  const { admin } = fakeAdmin(await connection({ status: 'reconnect_required' }))
  const f = fakeTokenEndpoint({ status: 200, body: {} })
  try {
    await assertRejects(() => getAccessToken(admin, 'u1'), ReconnectRequiredError)
    assertEquals(f.calls(), 0)
  } finally {
    f.restore()
  }
})

Deno.test('erro temporário não derruba a conexão e libera a trava', async () => {
  const { admin, db } = fakeAdmin(await connection({ token_expires_at: new Date(Date.now() - 1000).toISOString() }))
  const f = fakeTokenEndpoint({ status: 400, body: { error: 'invalid_client' } })
  try {
    await assertRejects(() => getAccessToken(admin, 'u1'))
    assertEquals(db.row.status, 'active')
    assertEquals(db.row.refresh_lock_until, null)
  } finally {
    f.restore()
  }
})
