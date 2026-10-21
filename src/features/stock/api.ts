import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ImportRow } from './csv'
import type { MovementType, Product, ProductVariant, StockItem, StockMovement } from './types'

const PAGE = 1000
const productSelect = '*, product_variants(*)'

function sortVariants(product: Product): Product {
  return { ...product, product_variants: [...(product.product_variants ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }
}

/** Todos os produtos do usuário, com variações (busca em blocos de 1.000). */
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const all: Product[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('products')
          .select(productSelect)
          .order('name')
          .range(from, from + PAGE - 1)
        if (error) throw error
        all.push(...(data as Product[]).map(sortVariants))
        if (data.length < PAGE) break
      }
      return all
    },
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['products', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select(productSelect).eq('id', id!).maybeSingle()
      if (error) throw error
      return data ? sortVariants(data as Product) : null
    },
  })
}

export function useMovements({ productId, limit = 200 }: { productId?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['stock-movements', productId ?? 'todos', limit],
    queryFn: async () => {
      let query = supabase
        .from('stock_movements')
        .select('*, products(name, sku), product_variants(name, sku)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (productId) query = query.eq('product_id', productId)
      const { data, error } = await query
      if (error) throw error
      return data as StockMovement[]
    },
  })
}

/** Itens no estoque mínimo ou abaixo (painel inicial). */
export function useLowStockItems() {
  return useQuery({
    queryKey: ['stock-items', 'low'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('*').eq('is_low', true).is('archived_at', null).order('current_stock').limit(50)
      if (error) throw error
      return data as StockItem[]
    },
  })
}

function useInvalidateStock() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-items'] }),
    ])
}

export type ProductInput = Pick<Product, 'name' | 'sku' | 'cost' | 'sale_price' | 'min_stock' | 'weight_g' | 'length_cm' | 'width_cm' | 'height_cm' | 'notes'>

export type VariantInput = Pick<ProductVariant, 'name' | 'sku' | 'cost' | 'sale_price' | 'min_stock'>

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(input).select(productSelect).single()
  if (error) throw error
  return data as Product
}

export async function updateProduct(id: string, input: Partial<ProductInput> & { photo_path?: string | null; archived_at?: string | null }) {
  const { error } = await supabase.from('products').update(input).eq('id', id)
  if (error) throw error
}

export async function createVariant(productId: string, input: VariantInput): Promise<ProductVariant> {
  const { data, error } = await supabase
    .from('product_variants')
    .insert({ ...input, product_id: productId })
    .select('*')
    .single()
  if (error) throw error
  return data as ProductVariant
}

export async function updateVariant(id: string, input: Partial<VariantInput>) {
  const { error } = await supabase.from('product_variants').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteVariant(id: string) {
  const { error } = await supabase.from('product_variants').delete().eq('id', id)
  if (error) throw error
}

export interface MovementInput {
  productId: string
  variantId: string | null
  type: MovementType
  /** Para "ajuste", é o estoque contado. */
  quantity: number
  reason?: string | null
}

export async function registerMovement({ productId, variantId, type, quantity, reason }: MovementInput) {
  const { data, error } = await supabase.rpc('register_stock_movement', {
    p_product_id: productId,
    p_variant_id: variantId,
    p_type: type,
    p_quantity: quantity,
    p_reason: reason ?? null,
  })
  if (error) throw error
  return data as StockMovement
}

export function useRegisterMovement() {
  const invalidate = useInvalidateStock()
  return useMutation({ mutationFn: registerMovement, onSuccess: invalidate })
}

export function useDeleteProduct() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: async (product: Pick<Product, 'id' | 'photo_path'>) => {
      const { error } = await supabase.from('products').delete().eq('id', product.id)
      if (error) throw error
      if (product.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([product.photo_path])
    },
    onSuccess: invalidate,
  })
}

export function useSetArchived() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => updateProduct(id, { archived_at: archived ? new Date().toISOString() : null }),
    onSuccess: invalidate,
  })
}

export interface ImportResult {
  line: number
  sku: string | null
  status: 'criado' | 'atualizado' | 'erro'
  message?: string
}

export function useImportProducts() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: async (rows: ImportRow[]) => {
      const { data, error } = await supabase.rpc('import_products', { p_rows: rows })
      if (error) throw error
      return data as ImportResult[]
    },
    onSuccess: invalidate,
  })
}

export { useInvalidateStock }

// --- Fotos -------------------------------------------------------------------

export const PHOTO_BUCKET = 'product-photos'
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function uploadProductPhoto(userId: string, productId: string, file: File): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${productId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

export async function removeProductPhoto(path: string) {
  await supabase.storage.from(PHOTO_BUCKET).remove([path])
}

/** Links temporários (1 hora) para exibir as fotos do bucket privado. */
export function usePhotoUrls(paths: (string | null)[]) {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))].sort()
  return useQuery({
    queryKey: ['photo-urls', unique],
    enabled: unique.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(unique, 3600)
      if (error) throw error
      return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])) as Record<string, string>
    },
  })
}
