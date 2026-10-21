// Logs em JSON (aparecem em Edge Functions → Logs), sem tokens nem segredos.
const SENSITIVE = /token|secret|authorization|password|code_verifier|^code$/i

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? '[oculto]' : redact(v, depth + 1)]))
  }
  if (typeof value === 'string' && value.length > 500) return value.slice(0, 500) + '…'
  return value
}

export function logInfo(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: 'info', event, ...(redact(data) as object) }))
}

export function logError(event: string, err: unknown, data: Record<string, unknown> = {}) {
  const error =
    err instanceof Error
      ? { message: err.message, name: err.name, ...('status' in err ? { status: (err as { status: unknown }).status } : {}) }
      : { message: String(err) }
  console.error(JSON.stringify({ level: 'error', event, error, ...(redact(data) as object) }))
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
