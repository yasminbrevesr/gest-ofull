// Respostas HTTP padronizadas das Edge Functions.
import { logError } from './log.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Erro com mensagem pronta para mostrar ao usuário. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** Envolve o handler: CORS, só POST, erros conhecidos viram { error } e o resto vira 500 genérico. */
export function serve(name: string, fn: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)
    try {
      return await fn(req)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      logError(`${name}.unexpected`, err)
      return json({ error: 'Erro inesperado no servidor. Tente de novo em instantes.' }, 500)
    }
  })
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const text = await req.text()
    return (text ? JSON.parse(text) : {}) as T
  } catch {
    throw new HttpError(400, 'Requisição inválida')
  }
}
