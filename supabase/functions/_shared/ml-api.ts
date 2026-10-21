// Cliente HTTP da API do Mercado Livre: timeout, retry com backoff para
// erros temporários (429, 5xx, falha de rede) e mensagens de erro legíveis.
import { optionalEnv } from './env.ts'
import { logInfo } from './log.ts'

export const ML_API_URL = () => optionalEnv('ML_API_URL', 'https://api.mercadolibre.com')

export class MlApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Código de erro do Mercado Livre (ex.: invalid_grant). */
    public code: string | null = null,
    public body: unknown = null,
  ) {
    super(message)
    this.name = 'MlApiError'
  }

  /** Vale tentar de novo mais tarde? */
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500
  }
}

export interface MlRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  token?: string
  body?: unknown
  /** Envia como application/x-www-form-urlencoded (usado no /oauth/token). */
  form?: Record<string, string>
  query?: Record<string, string | number | undefined>
  headers?: Record<string, string>
  /** Tentativas extras para erros temporários. */
  retries?: number
  timeoutMs?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Espera do backoff: respeita Retry-After; senão 1s, 2s, 4s… (máx. 10s) com variação. */
export function backoffDelay(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter ? Number(retryAfter) : NaN
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000)
  return Math.min(1000 * 2 ** attempt, 10_000) + Math.floor(Math.random() * 300)
}

function errorFromBody(status: number, body: unknown): MlApiError {
  const b = (body ?? {}) as Record<string, unknown>
  const cause = Array.isArray(b.cause)
    ? (b.cause as { message?: string }[])
        .map((c) => c.message)
        .filter(Boolean)
        .join('; ')
    : ''
  const message = [b.message, b.error_description, cause].filter((v) => typeof v === 'string' && v).join(' — ') || `Erro ${status} na API do Mercado Livre`
  return new MlApiError(status, String(message), typeof b.error === 'string' ? b.error : null, body)
}

export async function mlRequest<T = unknown>(path: string, options: MlRequestOptions = {}): Promise<T> {
  const { method = 'GET', token, body, form, query, headers = {}, retries = 3, timeoutMs = 20_000 } = options
  const url = new URL(path.startsWith('http') ? path : `${ML_API_URL()}${path}`)
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v))

  const init: RequestInit = { method, headers: { Accept: 'application/json', ...headers } }
  const h = init.headers as Record<string, string>
  if (token) h.Authorization = `Bearer ${token}`
  if (form) {
    h['Content-Type'] = 'application/x-www-form-urlencoded'
    init.body = new URLSearchParams(form).toString()
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch (err) {
      if (attempt < retries) {
        await sleep(backoffDelay(attempt, null))
        continue
      }
      throw new MlApiError(0, `Sem resposta do Mercado Livre (${err instanceof Error ? err.name : 'erro de rede'})`)
    }

    const text = await response.text()
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    if (response.ok) return parsed as T

    const error = errorFromBody(response.status, parsed)
    // 409 em PUT = "optimistic locking" do Mercado Livre: espera e tenta de novo.
    const retryable = error.retryable || (response.status === 409 && method === 'PUT')
    if (retryable && attempt < retries) {
      const delay = backoffDelay(attempt, response.headers.get('Retry-After'))
      logInfo('ml.retry', { path: url.pathname, status: response.status, attempt: attempt + 1, delay })
      await sleep(delay)
      continue
    }
    throw error
  }
}

/** Executa tarefas com no máximo `limit` ao mesmo tempo (respeita o limite de requisições). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
