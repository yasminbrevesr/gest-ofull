import { HttpError } from './http.ts'

/** Lê uma variável de ambiente obrigatória (segredo das Edge Functions). */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    console.error(JSON.stringify({ level: 'error', event: 'config.missing_env', name }))
    throw new HttpError(500, 'A integração ainda não foi configurada no servidor. Avise o suporte.')
  }
  return value
}

export const optionalEnv = (name: string, fallback: string) => Deno.env.get(name) || fallback
