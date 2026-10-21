import { Check, ExternalLink, Link2, Link2Off, RefreshCw, Search, Store, Undo2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useStockItems } from '../stock/api'
import type { StockItem } from '../stock/types'
import { useConfirmSuggestions, useMlListings, useRefreshSuggestions, useUpdateLink } from './api'
import { itemStatusNames, linkStatusNames, listingTypeNames, type LinkStatus, type MlListing } from './types'

type Filter = 'todos' | LinkStatus

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const itemKey = (item: Pick<StockItem, 'product_id' | 'variant_id'>) => `${item.product_id}|${item.variant_id ?? ''}`
const itemLabel = (item: StockItem) => `${item.product_name}${item.variant_name ? ` — ${item.variant_name}` : ''} (${item.sku})`

export function ListingsTab({ onImport, importing }: { onImport: () => void; importing: boolean }) {
  const listings = useMlListings()
  const stockItems = useStockItems()
  const confirmAll = useConfirmSuggestions()
  const refresh = useRefreshSuggestions()
  const [filter, setFilter] = useState<Filter>('todos')
  const [query, setQuery] = useState('')

  const itemsByKey = useMemo(() => new Map((stockItems.data ?? []).map((i) => [itemKey(i), i])), [stockItems.data])
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { todos: 0, suggested: 0, unlinked: 0, linked: 0, ignored: 0 }
    for (const l of listings.data ?? []) {
      c.todos++
      c[l.link_status]++
    }
    return c
  }, [listings.data])
  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    return (listings.data ?? []).filter(
      (l) =>
        (filter === 'todos' || l.link_status === filter) &&
        (!q || normalize(`${l.title} ${l.variation_label ?? ''} ${l.seller_sku ?? ''} ${l.ml_item_id}`).includes(q)),
    )
  }, [listings.data, filter, query])

  if (listings.isLoading || stockItems.isLoading) return <LoadingState rows={5} />
  if (listings.error || stockItems.error)
    return <ErrorState error={listings.error ?? stockItems.error} onRetry={() => (listings.refetch(), stockItems.refetch())} />

  if (!listings.data!.length) {
    return (
      <EmptyState
        icon={<Store />}
        title="Nenhum anúncio importado"
        description="Importe seus anúncios para ligar cada um ao produto do estoque."
        action={
          <Button onClick={onImport} disabled={importing}>
            <RefreshCw className={cn(importing && 'animate-spin')} /> {importing ? 'Importando…' : 'Importar anúncios'}
          </Button>
        }
      />
    )
  }

  const filters: Filter[] = ['todos', 'suggested', 'unlinked', 'linked', 'ignored']

  return (
    <div className="space-y-4">
      {counts.suggested > 0 && (
        <Card className="flex flex-col gap-3 border-butter/40 bg-butter/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <strong>{counts.suggested} anúncio(s)</strong> com SKU igual ao de um produto do estoque. Confira e confirme o vínculo.
          </p>
          <Button
            size="sm"
            disabled={confirmAll.isPending}
            onClick={async () => {
              try {
                const n = await confirmAll.mutateAsync()
                toast.success(`${n} vínculo(s) confirmado(s).`)
              } catch (err) {
                toast.error(errorMessage(err))
              }
            }}
          >
            <Check /> Confirmar todas as sugestões
          </Button>
        </Card>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            {filters.map((f) => (
              <TabsTrigger key={f} value={f}>
                {f === 'todos' ? 'Todos' : linkStatusNames[f]} <span className="tabular text-xs opacity-70">{counts[f]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Buscar anúncio ou SKU"
              aria-label="Buscar anúncio"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            title="Procura de novo produtos com o mesmo SKU dos anúncios sem vínculo"
            disabled={refresh.isPending}
            onClick={async () => {
              try {
                const n = await refresh.mutateAsync()
                toast.success(n ? `${n} nova(s) sugestão(ões).` : 'Nenhuma nova sugestão encontrada.')
              } catch (err) {
                toast.error(errorMessage(err))
              }
            }}
          >
            <Link2 /> Sugerir pelo SKU
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Search />} title="Nenhum anúncio neste filtro" />
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((listing) => (
            <ListingRow key={listing.id} listing={listing} itemsByKey={itemsByKey} items={stockItems.data!} />
          ))}
        </Card>
      )}
      {stockItems.data!.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem produtos no estoque.{' '}
          <Link to="/estoque/novo" className="font-semibold text-primary-text underline-offset-4 hover:underline">
            Cadastre um produto
          </Link>{' '}
          com o mesmo SKU do anúncio para vincular.
        </p>
      )}
    </div>
  )
}

const linkBadge: Record<LinkStatus, 'success' | 'warning' | 'muted' | 'outline'> = {
  linked: 'success',
  suggested: 'warning',
  unlinked: 'muted',
  ignored: 'outline',
}

function ListingRow({ listing, items, itemsByKey }: { listing: MlListing; items: StockItem[]; itemsByKey: Map<string, StockItem> }) {
  const update = useUpdateLink()
  const [editing, setEditing] = useState(false)
  const current = listing.product_id ? itemsByKey.get(`${listing.product_id}|${listing.variant_id ?? ''}`) : undefined
  const [choice, setChoice] = useState(current ? itemKey(current) : '')

  async function save(productId: string | null, variantId: string | null, status: LinkStatus, success: string) {
    try {
      await update.mutateAsync({ id: listing.id, productId, variantId, status })
      toast.success(success)
      setEditing(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        {listing.thumbnail ? (
          <img src={listing.thumbnail} alt="" className="size-14 shrink-0 rounded-lg border border-border bg-white object-contain" loading="lazy" />
        ) : (
          <span className="size-14 shrink-0 rounded-lg bg-muted" />
        )}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {listing.permalink ? (
              <a href={listing.permalink} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-primary-text hover:underline">
                {listing.title} <ExternalLink className="inline size-3.5 align-baseline" aria-label="(abre o anúncio)" />
              </a>
            ) : (
              <span className="font-semibold">{listing.title}</span>
            )}
            {listing.is_full && <Badge variant="default">Full</Badge>}
            {listing.status && listing.status !== 'active' && <Badge variant="muted">{itemStatusNames[listing.status] ?? listing.status}</Badge>}
          </div>
          {listing.variation_label && <p className="text-sm">{listing.variation_label}</p>}
          <p className="text-xs text-muted-foreground">
            {listing.ml_item_id}
            {listing.listing_type_id && ` · ${listingTypeNames[listing.listing_type_id] ?? listing.listing_type_id}`} · {formatCurrency(listing.price)} ·
            Estoque no ML: {listing.ml_available_quantity ?? '—'}
          </p>
          <p className="text-xs">
            SKU no anúncio: {listing.seller_sku ? <strong>{listing.seller_sku}</strong> : <span className="text-muted-foreground">não informado</span>}
          </p>
          {listing.last_push_status && (
            <p className={cn('text-xs', listing.last_push_status === 'error' ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {listing.last_push_status === 'error' && <span className="mr-1 inline-block size-2 rounded-full bg-coral align-middle" aria-hidden />}
              Último envio {listing.last_pushed_at && `em ${formatDateTime(listing.last_pushed_at)}`}:{' '}
              {listing.last_push_status === 'success'
                ? `${listing.last_pushed_quantity ?? '—'} un.`
                : listing.last_push_status === 'skipped'
                  ? `pulado — ${listing.last_push_error ?? ''}`
                  : `erro — ${listing.last_push_error ?? ''}`}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 md:w-80">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={linkBadge[listing.link_status]}>{linkStatusNames[listing.link_status]}</Badge>
          {current && (
            <Link to={`/estoque/${current.product_id}`} className="truncate text-sm font-medium text-primary-text hover:underline">
              {current.product_name}
              {current.variant_name && ` — ${current.variant_name}`}
            </Link>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <NativeSelect aria-label="Produto do estoque" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Escolha o produto do estoque</option>
              {items.map((item) => (
                <option key={itemKey(item)} value={itemKey(item)}>
                  {itemLabel(item)}
                </option>
              ))}
            </NativeSelect>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!choice || update.isPending}
                onClick={() => {
                  const [productId, variantId] = choice.split('|')
                  save(productId, variantId || null, 'linked', 'Anúncio vinculado.')
                }}
              >
                Salvar vínculo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {listing.link_status === 'suggested' && (
              <Button size="sm" onClick={() => save(listing.product_id, listing.variant_id, 'linked', 'Vínculo confirmado.')} disabled={update.isPending}>
                <Check /> Confirmar
              </Button>
            )}
            {listing.link_status !== 'ignored' && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Link2 /> {listing.product_id ? 'Trocar produto' : 'Vincular'}
              </Button>
            )}
            {listing.link_status === 'linked' && (
              <Button size="sm" variant="ghost" onClick={() => save(null, null, 'unlinked', 'Vínculo removido.')} disabled={update.isPending}>
                <Link2Off /> Desvincular
              </Button>
            )}
            {(listing.link_status === 'unlinked' || listing.link_status === 'suggested') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => save(null, null, 'ignored', 'Anúncio ignorado: ele não será sincronizado.')}
                disabled={update.isPending}
              >
                <X /> Ignorar
              </Button>
            )}
            {listing.link_status === 'ignored' && (
              <Button size="sm" variant="ghost" onClick={() => save(null, null, 'unlinked', 'Anúncio voltou para "sem vínculo".')} disabled={update.isPending}>
                <Undo2 /> Voltar a considerar
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
