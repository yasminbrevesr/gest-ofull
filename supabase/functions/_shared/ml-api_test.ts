import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { backoffDelay, chunk, mapLimit, MlApiError, mlRequest } from './ml-api.ts'

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | 'network-error'

/** Troca o fetch global por respostas pré-definidas e registra as chamadas. */
function fakeFetch(replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const original = globalThis.fetch
  globalThis.fetch = ((input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init })
    const reply = replies.shift()
    if (!reply || reply === 'network-error') return Promise.reject(new TypeError('network'))
    return Promise.resolve(new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status, headers: reply.headers }))
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

Deno.test('tenta de novo após 429 respeitando Retry-After', async () => {
  const f = fakeFetch([
    { status: 429, headers: { 'Retry-After': '0' } },
    { status: 200, body: { ok: true } },
  ])
  try {
    assertEquals(await mlRequest('/items/MLB1', { token: 't' }), { ok: true })
    assertEquals(f.calls.length, 2)
    assertEquals((f.calls[0].init.headers as Record<string, string>).Authorization, 'Bearer t')
  } finally {
    f.restore()
  }
})

Deno.test('409 em PUT (optimistic locking) é tentado de novo', async () => {
  const f = fakeFetch([
    { status: 409, headers: { 'Retry-After': '0' }, body: { message: 'conflict' } },
    { status: 200, body: { available_quantity: 5 } },
  ])
  try {
    assertEquals(await mlRequest('/items/MLB1', { method: 'PUT', body: { available_quantity: 5 } }), { available_quantity: 5 })
    assertEquals(f.calls[1].init.body, JSON.stringify({ available_quantity: 5 }))
  } finally {
    f.restore()
  }
})

Deno.test('erro do vendedor (400) não é repetido e traz a mensagem do Mercado Livre', async () => {
  const f = fakeFetch([{ status: 400, body: { message: 'Validation error', error: 'validation_error', cause: [{ message: 'available_quantity inválida' }] } }])
  try {
    const err = await assertRejects(() => mlRequest('/items/MLB1', { method: 'PUT', body: {} }), MlApiError)
    assertEquals(err.status, 400)
    assertEquals(err.code, 'validation_error')
    assertEquals(err.message, 'Validation error — available_quantity inválida')
    assertEquals(err.retryable, false)
    assertEquals(f.calls.length, 1)
  } finally {
    f.restore()
  }
})

Deno.test('falha de rede vira erro temporário depois das tentativas', async () => {
  const f = fakeFetch(['network-error', 'network-error'])
  try {
    const err = await assertRejects(() => mlRequest('/items/MLB1', { retries: 1 }), MlApiError)
    assertEquals(err.status, 0)
    assertEquals(err.retryable, true)
    assertEquals(f.calls.length, 2)
  } finally {
    f.restore()
  }
})

Deno.test('formulário do OAuth vai como x-www-form-urlencoded', async () => {
  const f = fakeFetch([{ status: 200, body: { access_token: 'a' } }])
  try {
    await mlRequest('/oauth/token', { method: 'POST', form: { grant_type: 'refresh_token', refresh_token: 'r' } })
    assertEquals((f.calls[0].init.headers as Record<string, string>)['Content-Type'], 'application/x-www-form-urlencoded')
    assertEquals(f.calls[0].init.body, 'grant_type=refresh_token&refresh_token=r')
  } finally {
    f.restore()
  }
})

Deno.test('backoff cresce e respeita o teto', () => {
  assertEquals(backoffDelay(0, '3'), 3000)
  assertEquals(backoffDelay(0, '120'), 10_000)
  const d = backoffDelay(2, null)
  assertEquals(d >= 4000 && d < 4300, true)
  assertEquals(backoffDelay(10, null) <= 10_300, true)
})

Deno.test('mapLimit mantém a ordem e o limite de concorrência', async () => {
  let running = 0
  let peak = 0
  const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
    running++
    peak = Math.max(peak, running)
    await new Promise((r) => setTimeout(r, 5))
    running--
    return n * 10
  })
  assertEquals(out, [10, 20, 30, 40, 50])
  assertEquals(peak, 2)
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
})
