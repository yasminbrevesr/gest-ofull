import { logError } from './log.ts'
import type { Admin } from './supabase.ts'

export interface SyncLogEntry {
  user_id: string
  kind: 'import' | 'push_stock' | 'sale' | 'item_update' | 'reconcile' | 'token_refresh' | 'connection'
  status: 'success' | 'error' | 'skipped' | 'info'
  message: string
  ml_item_id?: string | null
  ml_variation_id?: number | null
  product_id?: string | null
  variant_id?: string | null
  details?: Record<string, unknown> | null
  event_id?: string | null
}

/** Registro visível ao usuário. Falhar ao gravar o log nunca interrompe o fluxo. */
export async function writeSyncLog(admin: Admin, entries: SyncLogEntry | SyncLogEntry[]) {
  const rows = Array.isArray(entries) ? entries : [entries]
  if (!rows.length) return
  const { error } = await admin.from('sync_logs').insert(rows)
  if (error) logError('sync_log.insert_failed', error, { count: rows.length })
}
