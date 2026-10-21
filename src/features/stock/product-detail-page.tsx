import { Archive, ArchiveRestore, ArrowLeft, ArrowLeftRight, Calculator, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { useSimulationsForProduct } from '../calculator/api'
import { useListingsForProduct } from '../mercadolivre/api'
import { useDeleteProduct, useMovements, usePhotoUrls, useProduct, useSetArchived } from './api'
import { MovementDialog } from './movement-dialog'
import { MovementList } from './movement-list'
import { ProductPhoto } from './product-photo'
import { StockStatusBadge } from './stock-badges'
import { itemStatus, productStatus } from './stock-logic'
import type { Product } from './types'

/** Link para a calculadora já preenchida com os dados do produto. */
export function calculatorLink(product: Pick<Product, 'id' | 'name' | 'cost' | 'sale_price' | 'weight_g'>) {
  const params = new URLSearchParams({ produto: product.id, nome: product.name })
  if (product.cost != null) params.set('custo', String(product.cost))
  if (product.sale_price != null) params.set('preco', String(product.sale_price))
  if (product.weight_g != null) params.set('peso', String(product.weight_g))
  return `/calculadora?${params}`
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const product = useProduct(id)

  if (product.isLoading) return <LoadingState rows={6} />
  if (product.error) return <ErrorState error={product.error} onRetry={() => product.refetch()} />
  if (!product.data) {
    return (
      <EmptyState
        title="Produto não encontrado"
        description="Ele pode ter sido excluído."
        action={
          <Button asChild>
            <Link to="/estoque">Voltar ao estoque</Link>
          </Button>
        }
      />
    )
  }
  return <ProductDetail product={product.data} />
}

function ProductDetail({ product }: { product: Product }) {
  const navigate = useNavigate()
  const movements = useMovements({ productId: product.id })
  const simulations = useSimulationsForProduct(product.id)
  const listings = useListingsForProduct(product.id)
  const photo = usePhotoUrls([product.photo_path])
  const remove = useDeleteProduct()
  const archive = useSetArchived()
  const [moving, setMoving] = useState<{ variantId: string | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const grossMargin = product.cost != null && product.sale_price ? ((product.sale_price - product.cost) / product.sale_price) * 100 : null

  async function toggleArchive() {
    try {
      await archive.mutateAsync({ id: product.id, archived: !product.archived_at })
      toast.success(product.archived_at ? 'Produto reativado.' : 'Produto arquivado. Ele some da lista principal, mas o histórico fica guardado.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <Link to="/estoque" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline">
        <ArrowLeft className="size-4" /> Estoque
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <ProductPhoto url={product.photo_path ? photo.data?.[product.photo_path] : null} name={product.name} className="size-20" />
          <div className="space-y-1.5">
            <h1 className="text-2xl leading-tight sm:text-3xl">{product.name}</h1>
            <p className="text-sm text-muted-foreground">SKU {product.sku}</p>
            <StockStatusBadge status={productStatus(product)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMoving({ variantId: null })} disabled={Boolean(product.archived_at)}>
            <ArrowLeftRight /> Movimentar
          </Button>
          <Button asChild variant="outline">
            <Link to={`/estoque/${product.id}/editar`}>
              <Pencil /> Editar
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Mais ações">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(calculatorLink(product))}>
                <Calculator /> Calcular lucro
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggleArchive}>
                {product.archived_at ? <ArchiveRestore /> : <Archive />} {product.archived_at ? 'Reativar' : 'Arquivar'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {product.archived_at && (
        <Alert variant="warning" className="mb-5">
          Produto arquivado: não aparece na lista principal nem nos alertas.
        </Alert>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Estoque atual" value={`${formatNumber(product.current_stock)} un.`} />
        <Tile
          label={product.has_variants ? 'Variações' : 'Estoque mínimo'}
          value={product.has_variants ? String(product.product_variants.length) : `${product.min_stock} un.`}
        />
        <Tile label="Custo / preço" value={`${formatCurrency(product.cost)} / ${formatCurrency(product.sale_price)}`} />
        <Tile label="Margem bruta" value={formatPercent(grossMargin)} hint="Sem tarifas. Use a calculadora para o lucro real." />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {product.has_variants && (
            <Card>
              <CardHeader>
                <CardTitle>Variações</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variação</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.product_variants.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{v.sku}</TableCell>
                        <TableCell className="tabular text-right font-semibold">{v.current_stock}</TableCell>
                        <TableCell className="tabular text-right">{v.min_stock}</TableCell>
                        <TableCell>
                          <StockStatusBadge status={itemStatus(v.current_stock, v.min_stock)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="soft" onClick={() => setMoving({ variantId: v.id })} disabled={Boolean(product.archived_at)}>
                            Movimentar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Histórico de movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              {movements.isLoading ? (
                <LoadingState rows={3} />
              ) : movements.error ? (
                <ErrorState error={movements.error} onRetry={() => movements.refetch()} />
              ) : (
                <MovementList movements={movements.data!} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Simulações de lucro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {simulations.data?.length ? (
                <ul className="space-y-2">
                  {simulations.data.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <Link to={`/calculadora?simulacao=${s.id}`} className="truncate font-medium text-primary-text hover:underline">
                        {s.name}
                      </Link>
                      <span className="tabular shrink-0">{formatCurrency(s.net_profit)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Nenhuma simulação vinculada.</p>
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to={calculatorLink(product)}>
                  <Calculator /> Calcular lucro deste produto
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Anúncios no Mercado Livre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {listings.data?.length ? (
                <ul className="space-y-2">
                  {listings.data.map((l) => {
                    const variant = product.product_variants.find((v) => v.id === l.variant_id)
                    return (
                      <li key={l.id} className="space-y-0.5">
                        <a href={l.permalink ?? undefined} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-text hover:underline">
                          {l.title}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {l.ml_item_id}
                          {variant && ` · ${variant.name}`}
                          {l.is_full ? ' · Full (estoque do Mercado Livre)' : ` · ${l.ml_available_quantity ?? '—'} un. no ML`}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-muted-foreground">Nenhum anúncio vinculado.</p>
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/mercado-livre">Gerenciar vínculos</Link>
              </Button>
            </CardContent>
          </Card>
          {(product.weight_g || product.length_cm || product.notes) && (
            <Card>
              <CardHeader>
                <CardTitle>Detalhes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {product.weight_g != null && <p>Peso: {formatNumber(product.weight_g)} g</p>}
                {product.length_cm != null && (
                  <p>
                    Medidas: {formatNumber(product.length_cm, 1)} × {formatNumber(product.width_cm, 1)} × {formatNumber(product.height_cm, 1)} cm
                  </p>
                )}
                {product.notes && <p className="whitespace-pre-line text-muted-foreground">{product.notes}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {moving && <MovementDialog product={product} initialVariantId={moving.variantId} open onOpenChange={(open) => !open && setMoving(null)} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir produto?"
        description="O produto, as variações e todo o histórico de estoque serão apagados. Se só não vende mais, prefira arquivar."
        confirmLabel="Excluir definitivamente"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(product)
            toast.success('Produto excluído.')
            navigate('/estoque', { replace: true })
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 text-lg font-semibold">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
