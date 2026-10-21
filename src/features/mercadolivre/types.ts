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
  divergence_count: number
  last_reconcile_at: string | null
}

export interface MlEvent {
  id: string
  source: 'webhook' | 'system'
  topic: string
  resource: string
  status: 'pending' | 'processing' | 'processed' | 'error' | 'ignored'
  attempts: number
  next_attempt_at: string
  last_error: string | null
  processed_at: string | null
  created_at: string
}

export interface Divergence {
  listing_id: string
  ml_item_id: string
  ml_variation_id: number
  title: string
  variation_label: string | null
  permalink: string | null
  product_id: string
  variant_id: string | null
  product_name: string
  variant_name: string | null
  sku: string
  local_quantity: number
  ml_quantity: number
  ml_checked_at: string | null
}

export const eventTopicNames: Record<string, string> = { orders_v2: 'Venda', items: 'Anúncio', stock_push: 'Envio de estoque' }

export const eventStatusNames: Record<MlEvent['status'], string> = {
  pending: 'Na fila',
  processing: 'Processando',
  processed: 'Concluído',
  error: 'Erro',
  ignored: 'Ignorado',
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
