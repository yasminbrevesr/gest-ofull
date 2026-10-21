import { ArrowLeftRight, ChevronDown, Download, History, Package, Plus, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePhotoUrls, useProducts } from './api'
import { productsToCsv } from './csv'
import { MovementDialog } from './movement-dialog'
import { ProductPhoto } from './product-photo'
import { StockStatusBadge } from './stock-badges'
import { filterProducts, itemStatus, productStatus, summarizeStock, type StockFilter } from './stock-logic'
import type { Product } from './types'

const filters: { value: StockFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'baixo', label: 'Estoque baixo' },
  { value: 'sem-estoque', label: 'Sem estoque' },
  { value: 'arquivados', label: 'Arquivados' },
]

export function downloadFile(content: string, filename: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  link.click()
  URL.revokeObjectURL(url)
}

export default function StockPage() {
  const products = useProducts()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filtro') as StockFilter) || 'todos'
  const [query, setQuery] = useState('')
  const [moving, setMoving] = useState<Product | null>(null)

  const list = useMemo(() => filterProducts(products.data ?? [], query, filter), [products.data, query, filter])
  const summary = useMemo(() => summarizeStock(products.data ?? []), [products.data])
  const photos = usePhotoUrls(list.map((p) => p.photo_path))

  function exportCsv() {
    const active = (products.data ?? []).filter((p) => !p.archived_at)
    downloadFile(productsToCsv(active), `estoque-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <>
      <PageHeader
        title={
          <>
            Controle de <Highlight>estoque</Highlight>
          </>
        }
        description="Cadastre seus produtos e registre cada entrada e saída. O saldo é sempre calculado pelo histórico."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/estoque/importar">
                <Upload /> Importar
              </Link>
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!products.data?.length}>
              <Download /> Exportar
            </Button>
            <Button asChild>
              <Link to="/estoque/novo">
                <Plus /> Novo produto
              </Link>
            </Button>
          </>
        }
      />

      {products.isLoading ? (
        <LoadingState rows={6} />
      ) : products.error ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : products.data!.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="Nenhum produto cadastrado"
          description="Cadastre o primeiro produto ou importe uma planilha com vários de uma vez."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/estoque/novo">
                  <Plus /> Cadastrar produto
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/estoque/importar">
                  <Upload /> Importar planilha
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile label="Produtos ativos" value={formatNumber(summary.products)} />
            <SummaryTile label="Unidades em estoque" value={formatNumber(summary.units)} />
            <SummaryTile label="Itens com estoque baixo" value={formatNumber(summary.lowItems)} highlight={summary.lowItems > 0} />
            <SummaryTile label="Valor em estoque (custo)" value={formatCurrency(summary.stockValue)} />
          </dl>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Tabs value={filter} onValueChange={(v) => setParams(v === 'todos' ? {} : { filtro: v }, { replace: true })}>
              <TabsList>
                {filters.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="search"
                  placeholder="Buscar por nome ou SKU"
                  aria-label="Buscar produto"
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button asChild variant="ghost" size="icon" aria-label="Histórico de movimentações" title="Histórico de movimentações">
                <Link to="/estoque/movimentacoes">
                  <History />
                </Link>
              </Button>
            </div>
          </div>

          {list.length === 0 ? (
            <EmptyState icon={<Search />} title="Nenhum produto encontrado" description="Mude a busca ou o filtro." />
          ) : (
            <Card className="divide-y divide-border">
              {list.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  photoUrl={product.photo_path ? photos.data?.[product.photo_path] : null}
                  onMove={() => setMoving(product)}
                />
              ))}
            </Card>
          )}
        </div>
      )}

      {moving && <MovementDialog product={moving} open onOpenChange={(open) => !open && setMoving(null)} />}
    </>
  )
}

function SummaryTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={cn('p-4', highlight && 'border-butter/45 bg-butter/10')}>
      <dt className="text-xs text-muted-foreground dark:text-foreground/80">{label}</dt>
      <dd className="tabular mt-1 font-display text-2xl font-semibold">{value}</dd>
    </Card>
  )
}

function ProductRow({ product, photoUrl, onMove }: { product: Product; photoUrl?: string | null; onMove: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const status = productStatus(product)

  const actions = (
    <>
      <StockStatusBadge status={status} />
      <div className="flex gap-1">
        {product.has_variants && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
            Variações <ChevronDown className={cn('transition-transform duration-150', expanded && 'rotate-180')} />
          </Button>
        )}
        <Button variant="soft" size="sm" onClick={onMove} disabled={Boolean(product.archived_at)}>
          <ArrowLeftRight /> Movimentar
        </Button>
      </div>
    </>
  )

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <Link to={`/estoque/${product.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md">
          <ProductPhoto url={photoUrl} name={product.name} />
          <span className="min-w-0">
            <span className="block truncate font-semibold hover:text-primary-text">{product.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              SKU {product.sku}
              {product.has_variants && ` · ${product.product_variants.length} variações`}
            </span>
          </span>
        </Link>
        <dl className="flex items-center gap-5 text-sm">
          <div className="text-right">
            <dt className="text-xs text-muted-foreground">Estoque</dt>
            <dd className="tabular text-lg font-semibold">{product.current_stock}</dd>
          </div>
          <div className="hidden min-w-20 text-right sm:block">
            <dt className="text-xs text-muted-foreground">Preço</dt>
            <dd className="tabular">{formatCurrency(product.sale_price)}</dd>
          </div>
        </dl>
        <div className="hidden items-center gap-2 lg:flex">{actions}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 lg:hidden">{actions}</div>
      {expanded && (
        <ul className="mt-3 space-y-1.5 rounded-lg bg-muted/60 p-3">
          {product.product_variants.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-medium">{v.name}</span> <span className="text-xs text-muted-foreground">· SKU {v.sku}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular">
                  {v.current_stock} un. <span className="text-xs text-muted-foreground">(mín. {v.min_stock})</span>
                </span>
                <StockStatusBadge status={itemStatus(v.current_stock, v.min_stock)} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
