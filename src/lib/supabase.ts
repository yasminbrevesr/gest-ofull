import { createClient } from '@supabase/supabase-js'
import { FunctionsHttpError } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** false quando o .env.local não foi preenchido (o app mostra um aviso). */
export const supabaseConfigured = Boolean(url && publishableKey)

export const supabase = createClient(url || 'http://localhost:54321', publishableKey || 'chave-ausente', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Mensagem amigável a partir de um erro do Supabase/PostgREST. */
export function errorMessage(error: unknown, fallback = 'Algo deu errado. Tente de novo.'): string {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error instanceof Error && error.message) return translateError(error.message)
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') return translateError(error.message)
  return fallback
}

const knownErrors: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada (e no spam).'],
  [/user already registered/i, 'Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/new password should be different/i, 'A nova senha precisa ser diferente da atual.'],
  [/rate limit|too many requests/i, 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'],
  [/failed to fetch|networkerror|load failed/i, 'Sem conexão com o servidor. Verifique sua internet.'],
  [/jwt expired/i, 'Sua sessão expirou. Entre de novo.'],
  [/duplicate key value.*sku/i, 'Já existe um produto ou variação com este SKU.'],
]

function translateError(message: string): string {
  for (const [pattern, friendly] of knownErrors) if (pattern.test(message)) return friendly
  return message
}

/**
 * Chama uma Edge Function com o token do usuário logado.
 * As funções respondem `{ error: "mensagem" }` em caso de falha.
 */
export async function invokeFunction<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body ?? {} })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      if (payload && typeof payload.error === 'string') throw new Error(payload.error)
    }
    throw new Error(errorMessage(error, 'Não foi possível falar com o servidor. Tente de novo.'))
  }
  return data as T
}
