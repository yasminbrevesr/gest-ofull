// Conversão dos anúncios da API do Mercado Livre para linhas de ml_listings.

export interface MlAttribute {
  id: string
  name?: string
  value_name?: string | null
}

export interface MlVariation {
  id: number
  available_quantity?: number
  price?: number
  seller_custom_field?: string | null
  attribute_combinations?: MlAttribute[]
  attributes?: MlAttribute[]
  user_product_id?: string | null
  inventory_id?: string | null
}

export interface MlItem {
  id: string
  title: string
  price?: number
  currency_id?: string
  available_quantity?: number
  status?: string
  permalink?: string
  thumbnail?: string
  secure_thumbnail?: string
  listing_type_id?: string
  seller_custom_field?: string | null
  attributes?: MlAttribute[]
  variations?: MlVariation[]
  shipping?: { logistic_type?: string | null } | null
  user_product_id?: string | null
  inventory_id?: string | null
}

export interface ListingRow {
  user_id: string
  ml_item_id: string
  ml_variation_id: number
  title: string
  variation_label: string | null
  seller_sku: string | null
  permalink: string | null
  thumbnail: string | null
  price: number | null
  currency_id: string | null
  status: string | null
  listing_type_id: string | null
  logistic_type: string | null
  is_full: boolean
  user_product_id: string | null
  inventory_id: string | null
  ml_available_quantity: number | null
  ml_checked_at: string
}

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** SKU do vendedor: atributo SELLER_SKU ou, nos anúncios antigos, seller_custom_field. */
export function extractSellerSku(entity: { attributes?: MlAttribute[]; seller_custom_field?: string | null }): string | null {
  const attr = entity.attributes?.find((a) => a.id === 'SELLER_SKU')
  return clean(attr?.value_name) ?? clean(entity.seller_custom_field)
}

/** "Cor: Azul · Tamanho: M" */
export function variationLabel(variation: MlVariation): string | null {
  const parts = (variation.attribute_combinations ?? []).filter((a) => a.value_name).map((a) => (a.name ? `${a.name}: ${a.value_name}` : String(a.value_name)))
  return parts.length ? parts.join(' · ') : null
}

/** Full = estoque guardado e controlado pelo Mercado Livre. */
export const isFullItem = (item: MlItem) => item.shipping?.logistic_type === 'fulfillment'

/** Uma linha por variação (ou uma linha para o anúncio sem variações). */
export function listingRows(item: MlItem, userId: string, checkedAt: string): ListingRow[] {
  const base = {
    user_id: userId,
    ml_item_id: item.id,
    title: item.title,
    permalink: item.permalink ?? null,
    thumbnail: item.secure_thumbnail ?? item.thumbnail ?? null,
    currency_id: item.currency_id ?? null,
    status: item.status ?? null,
    listing_type_id: item.listing_type_id ?? null,
    logistic_type: item.shipping?.logistic_type ?? null,
    is_full: isFullItem(item),
    ml_checked_at: checkedAt,
  }
  const variations = item.variations ?? []
  if (variations.length === 0) {
    return [
      {
        ...base,
        ml_variation_id: 0,
        variation_label: null,
        seller_sku: extractSellerSku(item),
        price: item.price ?? null,
        user_product_id: item.user_product_id ?? null,
        inventory_id: item.inventory_id ?? null,
        ml_available_quantity: item.available_quantity ?? null,
      },
    ]
  }
  return variations.map((v) => ({
    ...base,
    ml_variation_id: v.id,
    variation_label: variationLabel(v),
    seller_sku: extractSellerSku(v),
    price: v.price ?? item.price ?? null,
    user_product_id: v.user_product_id ?? item.user_product_id ?? null,
    inventory_id: v.inventory_id ?? item.inventory_id ?? null,
    ml_available_quantity: v.available_quantity ?? null,
  }))
}

/** Identificador estável de uma linha (anúncio + variação). */
export const listingKey = (itemId: string, variationId: number | string) => `${itemId}#${variationId}`
