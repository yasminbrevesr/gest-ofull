import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2'
import { timingSafeEqual } from './crypto.ts'
import { requireEnv } from './env.ts'
import { HttpError } from './http.ts'

export type Admin = SupabaseClient

/** Cliente com a chave secreta (ignora RLS). Só no servidor. */
export function adminClient(): Admin {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  const key = (keys ? (JSON.parse(keys) as Record<string, string>).default : undefined) ?? requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(requireEnv('SUPABASE_URL'), key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Valida o login do usuário que chamou a função (token do Supabase Auth). */
export async function requireUser(req: Request, admin: Admin): Promise<{ id: string; email?: string }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Faça login para continuar.')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Sua sessão expirou. Entre de novo.')
  return { id: data.user.id, email: data.user.email }
}

/** Chamadas do agendador (pg_cron) trazem o cabeçalho x-cron-secret. */
export function requireCron(req: Request) {
  const received = req.headers.get('x-cron-secret') ?? ''
  if (!timingSafeEqual(received, requireEnv('CRON_SECRET'))) throw new HttpError(401, 'Não autorizado')
}
