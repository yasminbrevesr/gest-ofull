// Recebe as notificações do Mercado Livre (tópicos orders_v2 e items).
// Responde 200 na hora e processa em segundo plano pela fila ml_events.
// Os dados nunca vêm da notificação: o pedido/anúncio é sempre buscado na API
// com o token do vendedor, então uma notificação falsa não altera nada.
import { processQueue } from '../_shared/events.ts'
import { errorText, logError, logInfo } from '../_shared/log.ts'
import { adminClient } from '../_shared/supabase.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

const TOPICS: Record<string, RegExp> = {
  orders_v2: /^\/orders\/\d+$/,
  items: /^\/items\/MLB\d+$/,
}

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok()
  let body: { topic?: string; resource?: string; user_id?: number | string; application_id?: number | string; attempts?: number; sent?: string }
  try {
    body = await req.json()
  } catch {
    return ok()
  }

  const { topic, resource, user_id, application_id } = body
  const clientId = Deno.env.get('ML_CLIENT_ID')
  if (!clientId || String(application_id) !== clientId) {
    logInfo('ml.webhook_ignored', { reason: 'application_id', topic })
    return ok()
  }
  if (!topic || !resource || !TOPICS[topic]?.test(resource) || !user_id) {
    logInfo('ml.webhook_ignored', { reason: 'topic_or_resource', topic, resource })
    return ok()
  }

  try {
    const admin = adminClient()
    const { error } = await admin.rpc('enqueue_ml_webhook', {
      p_topic: topic,
      p_resource: resource,
      p_ml_user_id: Number(user_id),
      p_payload: { attempts: body.attempts ?? null, sent: body.sent ?? null },
    })
    if (error) throw error

    // Processa logo em seguida, sem segurar a resposta. O agendador (1 min) cobre falhas.
    const work = processQueue(admin, { limit: 10, budgetMs: 25_000 }).catch((err) => logError('ml.webhook_process_failed', err))
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work)
  } catch (err) {
    // Não conseguiu gravar: responde 500 para o Mercado Livre reenviar a notificação.
    logError('ml.webhook_enqueue_failed', err, { topic, resource, message: errorText(err) })
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  return ok()
})
