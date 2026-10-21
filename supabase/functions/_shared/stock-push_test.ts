import { assertEquals } from 'jsr:@std/assert@1'
import { buildStockUpdate, pushListings, type LinkedListing } from './stock-push.ts'
import type { Admin } from './supabase.ts'

Deno.test('anúncio sem variação envia só available_quantity', () => {
  assertEquals(buildStockUpdate({ id: 'MLB1' }, new Map([[0, 7]])), { body: { available_quantity: 7 } })
})

Deno.test('com variações, manda todas e só altera as vinculadas (nenhuma é apagada)', () => {
  const item = {
    id: 'MLB2',
    variations: [
      { id: 1, available_quantity: 3 },
      { id: 2, available_quantity: 9 },
      { id: 3, available_quantity: 1 },
    ],
  }
  assertEquals(buildStockUpdate(item, new Map([[2, 4]])), { body: { variations: [{ id: 1 }, { id: 2, available_quantity: 4 }, { id: 3 }] } })
})

Deno.test('variação que sumiu ou anúncio que ganhou variações não é enviado', () => {
  assertEquals('error' in buildStockUpdate({ id: 'MLB2', variations: [{ id: 1 }] }, new Map([[5, 1]])), true)
  assertEquals('error' in buildStockUpdate({ id: 'MLB3', variations: [{ id: 1 }] }, new Map([[0, 1]])), true)
})

// --- Fluxo completo com banco e API falsos ----------------------------------

function fakeAdmin(stock: { product_id: string; variant_id: string | null; current_stock: number }[]) {
  const updates: { ids: string[]; values: Record<string, unknown> }[] = []
  const logs: { status: string; message: string }[] = []
  const admin = {
    from(table: string) {
      let values: Record<string, unknown> | null = null
      const b = {
        select: () => b,
        eq: (col: string, v: string) => (values ? Promise.resolve(updates.push({ ids: [v], values: values! })).then(() => ({ error: null })) : b),
        in: (_col: string, ids: string[]) =>
          table === 'stock_items'
            ? Promise.resolve({ data: stock, error: null })
            : Promise.resolve(updates.push({ ids, values: values! })).then(() => ({ error: null })),
        update(v: Record<string, unknown>) {
          values = v
          return b
        },
        insert(rows: { status: string; message: string }[]) {
          logs.push(...rows)
          return Promise.resolve({ error: null })
        },
      }
      return b
    },
  }
  return { admin: admin as unknown as Admin, updates, logs }
}

function fakeMl(handler: (method: string, url: URL, body: unknown) => { status: number; body: unknown }) {
  const original = globalThis.fetch
  const calls: { method: string; url: URL; body: unknown }[] = []
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ method, url, body })
    const reply = handler(method, url, body)
    return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status }))
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

const listing = (over: Partial<LinkedListing>): LinkedListing => ({
  id: 'l1',
  user_id: 'u1',
  ml_item_id: 'MLB1',
  ml_variation_id: 0,
  title: 'Caneca',
  variation_label: null,
  product_id: 'p1',
  variant_id: null,
  is_full: false,
  ml_available_quantity: 10,
  ...over,
})

Deno.test('envia o saldo do sistema e registra o sucesso', async () => {
  const { admin, logs } = fakeAdmin([{ product_id: 'p1', variant_id: null, current_stock: 7 }])
  const ml = fakeMl((method, _url, body) =>
    method === 'GET'
      ? { status: 200, body: { id: 'MLB1', status: 'active', available_quantity: 10 } }
      : { status: 200, body: { id: 'MLB1', available_quantity: (body as { available_quantity: number }).available_quantity } },
  )
  try {
    const summary = await pushListings(admin, 'u1', 'token', [listing({})])
    assertEquals(summary.pushed, 1)
    assertEquals(ml.calls[1], { method: 'PUT', url: new URL('https://api.mercadolibre.com/items/MLB1'), body: { available_quantity: 7 } })
    assertEquals(logs[0].status, 'success')
  } finally {
    ml.restore()
  }
})

Deno.test('saldo negativo no sistema vai como 0; quantidade igual não gera PUT', async () => {
  const { admin } = fakeAdmin([{ product_id: 'p1', variant_id: null, current_stock: -3 }])
  const ml = fakeMl(() => ({ status: 200, body: { id: 'MLB1', status: 'active', available_quantity: 0 } }))
  try {
    const summary = await pushListings(admin, 'u1', 'token', [listing({})])
    assertEquals(summary.unchanged, 1)
    assertEquals(ml.calls.filter((c) => c.method === 'PUT').length, 0)
  } finally {
    ml.restore()
  }
})

Deno.test('anúncio que virou Full é pulado sem PUT', async () => {
  const { admin, logs } = fakeAdmin([{ product_id: 'p1', variant_id: null, current_stock: 7 }])
  const ml = fakeMl(() => ({ status: 200, body: { id: 'MLB1', status: 'active', available_quantity: 30, shipping: { logistic_type: 'fulfillment' } } }))
  try {
    const summary = await pushListings(admin, 'u1', 'token', [listing({}), listing({ id: 'l2', ml_item_id: 'MLB2', is_full: true })])
    assertEquals(summary.skipped, 2)
    assertEquals(ml.calls.filter((c) => c.method === 'PUT').length, 0)
    assertEquals(
      logs.every((l) => l.status === 'skipped'),
      true,
    )
  } finally {
    ml.restore()
  }
})

Deno.test('Mercado Livre responde OK mas não aplica: vira erro visível', async () => {
  const { admin, logs } = fakeAdmin([{ product_id: 'p1', variant_id: null, current_stock: 7 }])
  const ml = fakeMl(() => ({ status: 200, body: { id: 'MLB1', status: 'active', available_quantity: 10 } }))
  try {
    const summary = await pushListings(admin, 'u1', 'token', [listing({})])
    assertEquals(summary.failed, 1)
    assertEquals(logs[0].message.includes('manteve 10 un.'), true)
  } finally {
    ml.restore()
  }
})

Deno.test('vínculo desatualizado nunca envia 0', async () => {
  const { admin } = fakeAdmin([{ product_id: 'p1', variant_id: 'v1', current_stock: 5 }])
  const ml = fakeMl(() => ({ status: 200, body: { id: 'MLB1', status: 'active', available_quantity: 10 } }))
  try {
    const summary = await pushListings(admin, 'u1', 'token', [listing({ variant_id: null })])
    assertEquals(summary.failed, 1)
    assertEquals(ml.calls.filter((c) => c.method === 'PUT').length, 0)
  } finally {
    ml.restore()
  }
})
