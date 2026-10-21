export interface MlConnection {
  seller_id: number
  nickname: string | null
  site_id: string | null
  status: 'active' | 'reconnect_required'
  sync_mode: 'manual' | 'automatic'
  token_expires_at: string
  last_error: string | null
  last_import_at: string | null
  last_sync_at: string | null
  last_sync_status: 'success' | 'partial' | 'error' | null
  connected_at: string
}

export type LinkStatus = 'unlinked' | 'suggested' | 'linked' | 'ignored'

export interface MlListing {
  id: string
  ml_item_id: string
  ml_variation_id: number
  title: string
  variation_label: string | null
  seller_sku: string | null
  permalink: string | null
  thumbnail: string | null
  price: number | null
  status: string | null
  listing_type_id: string | null
  logistic_type: string | null
  is_full: boolean
  ml_available_quantity: number | null
  ml_checked_at: string | null
  product_id: string | null
  variant_id: string | null
  link_status: LinkStatus
  last_pushed_quantity: number | null
  last_pushed_at: string | null
  last_push_status: 'success' | 'error' | 'skipped' | null
  last_push_error: string | null
  updated_at: string
}

export interface SyncLog {
  id: string
  kind: string
  status: 'success' | 'error' | 'skipped' | 'info'
  message: string
  ml_item_id: string | null
  ml_variation_id: number | null
  product_id: string | null
  variant_id: string | null
  details: Record<string, unknown> | null
  event_id: string | null
  created_at: string
}

export const listingTypeNames: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium', free: 'Grátis' }

export const itemStatusNames: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  closed: 'Finalizado',
  under_review: 'Em revisão',
  inactive: 'Inativo',
}

export const linkStatusNames: Record<LinkStatus, string> = {
  unlinked: 'Sem vínculo',
  suggested: 'Sugerido',
  linked: 'Vinculado',
  ignored: 'Ignorado',
}

export const syncKindNames: Record<string, string> = {
  import: 'Importação',
  push_stock: 'Envio de estoque',
  sale: 'Venda',
  item_update: 'Anúncio atualizado',
  reconcile: 'Conferência',
  token_refresh: 'Acesso',
  connection: 'Conexão',
}
