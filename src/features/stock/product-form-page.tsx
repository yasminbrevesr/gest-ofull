import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DecimalInput } from '@/components/common/decimal-input'
import { Field } from '@/components/common/field'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input, Textarea } from '@/components/ui/input'
import { errorMessage } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import { Term } from '../glossary/term'
import {
  createProduct,
  createVariant,
  deleteVariant,
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  registerMovement,
  removeProductPhoto,
  updateProduct,
  updateVariant,
  uploadProductPhoto,
  usePhotoUrls,
  useProduct,
  type ProductInput,
} from './api'
import { suggestSku } from './stock-logic'
import type { Product } from './types'

export default function ProductFormPage() {
  const { id } = useParams()
  const product = useProduct(id)

  if (id && product.isLoading) return <LoadingState rows={6} />
  if (id && product.error) return <ErrorState error={product.error} onRetry={() => product.refetch()} />
  if (id && !product.data) {
    return (
      <EmptyState
        title="Produto não encontrado"
        action={
          <Button asChild>
            <Link to="/estoque">Voltar ao estoque</Link>
          </Button>
        }
      />
    )
  }
  return <ProductForm key={product.data?.updated_at ?? 'novo'} product={product.data ?? null} />
}

interface VariantDraft {
  key: string
  id?: string
  name: string
  sku: string
  cost: number | null
  salePrice: number | null
  minStock: number | null
  /** Só para variações novas. */
  initialStock: number | null
}

let draftKey = 0
const newDraft = (): VariantDraft => ({ key: `novo-${++draftKey}`, name: '', sku: '', cost: null, salePrice: null, minStock: 0, initialStock: null })

function ProductForm({ product }: { product: Product | null }) {
  const editing = Boolean(product)
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [skuTouched, setSkuTouched] = useState(editing)
  const [cost, setCost] = useState<number | null>(product?.cost ?? null)
  const [salePrice, setSalePrice] = useState<number | null>(product?.sale_price ?? null)
  const [minStock, setMinStock] = useState<number | null>(product?.min_stock ?? 0)
  const [initialStock, setInitialStock] = useState<number | null>(null)
  const [weight, setWeight] = useState<number | null>(product?.weight_g ?? null)
  const [length, setLength] = useState<number | null>(product?.length_cm ?? null)
  const [width, setWidth] = useState<number | null>(product?.width_cm ?? null)
  const [height, setHeight] = useState<number | null>(product?.height_cm ?? null)
  const [notes, setNotes] = useState(product?.notes ?? '')
  const [hasVariants, setHasVariants] = useState(product?.has_variants ?? false)
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    product?.has_variants
      ? product.product_variants.map((v) => ({
          key: v.id,
          id: v.id,
          name: v.name,
          sku: v.sku,
          cost: v.cost,
          salePrice: v.sale_price,
          minStock: v.min_stock,
          initialStock: null,
        }))
      : [],
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [variantToDelete, setVariantToDelete] = useState<VariantDraft | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const existingPhoto = usePhotoUrls([product?.photo_path ?? null])
  const shownPhoto = photoPreview ?? (!removePhoto && product?.photo_path ? existingPhoto.data?.[product.photo_path] : null)
  const convertingToVariants = editing && !product!.has_variants && hasVariants && product!.current_stock !== 0

  useEffect(() => () => void (photoPreview && URL.revokeObjectURL(photoPreview)), [photoPreview])

  function choosePhoto(file: File | undefined) {
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) return toast.error('Use uma foto JPG, PNG ou WEBP.')
    if (file.size > MAX_PHOTO_BYTES) return toast.error('A foto precisa ter no máximo 5 MB.')
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setRemovePhoto(false)
  }

  function updateDraft(key: string, patch: Partial<VariantDraft>) {
    setVariants((list) => list.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }

  function validate(): string | null {
    if (!name.trim()) return 'Informe o nome do produto.'
    if (!sku.trim()) return 'Informe o SKU do produto.'
    if (/\s/.test(sku.trim())) return 'O SKU não pode ter espaços. Use hífen: CAMISETA-AZUL.'
    const ints = [minStock, initialStock, weight, ...variants.flatMap((v) => [v.minStock, v.initialStock])]
    if (ints.some((n) => n != null && (!Number.isInteger(n) || n < 0))) return 'Estoques e peso precisam ser números inteiros, sem valor negativo.'
    if (hasVariants) {
      if (variants.length === 0) return 'Adicione pelo menos uma variação (ou desmarque "tem variações").'
      const skus = new Set<string>([sku.trim().toLowerCase()])
      for (const v of variants) {
        if (!v.name.trim() || !v.sku.trim()) return 'Preencha o nome e o SKU de todas as variações.'
        if (/\s/.test(v.sku.trim())) return `O SKU "${v.sku}" não pode ter espaços.`
        const key = v.sku.trim().toLowerCase()
        if (skus.has(key)) return `O SKU "${v.sku}" está repetido.`
        skus.add(key)
      }
    }
    return null
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const invalid = validate()
    if (invalid) return setError(invalid)

    const input: ProductInput = {
      name: name.trim(),
      sku: sku.trim(),
      cost,
      sale_price: salePrice,
      min_stock: minStock ?? 0,
      weight_g: weight,
      length_cm: length,
      width_cm: width,
      height_cm: height,
      notes: notes.trim() || null,
    }

    setSaving(true)
    let productId = product?.id
    try {
      if (product) {
        await updateProduct(product.id, input)
      } else {
        productId = (await createProduct(input)).id
      }

      // Foto
      if (photoFile) {
        const path = await uploadProductPhoto(user!.id, productId!, photoFile)
        await updateProduct(productId!, { photo_path: path })
        if (product?.photo_path) await removeProductPhoto(product.photo_path)
      } else if (removePhoto && product?.photo_path) {
        await updateProduct(productId!, { photo_path: null })
        await removeProductPhoto(product.photo_path)
      }

      if (hasVariants) {
        if (convertingToVariants) {
          await registerMovement({
            productId: productId!,
            variantId: null,
            type: 'ajuste',
            quantity: 0,
            reason: 'Estoque passou a ser controlado por variação',
          })
        }
        for (const v of variants) {
          const variantInput = { name: v.name.trim(), sku: v.sku.trim(), cost: v.cost, sale_price: v.salePrice, min_stock: v.minStock ?? 0 }
          if (v.id) {
            await updateVariant(v.id, variantInput)
          } else {
            const created = await createVariant(productId!, variantInput)
            if (v.initialStock)
              await registerMovement({ productId: productId!, variantId: created.id, type: 'entrada', quantity: v.initialStock, reason: 'Estoque inicial' })
          }
        }
      } else if (!product && initialStock) {
        await registerMovement({ productId: productId!, variantId: null, type: 'entrada', quantity: initialStock, reason: 'Estoque inicial' })
      }

      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(editing ? 'Produto atualizado.' : 'Produto cadastrado.')
      navigate(`/estoque/${productId}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      // Produto novo já foi criado, mas algo depois falhou: abre a edição dele.
      if (!product && productId) {
        await queryClient.invalidateQueries({ queryKey: ['products'] })
        toast.error('O produto foi criado, mas parte dos dados não foi salva. Revise e salve de novo.')
        navigate(`/estoque/${productId}/editar`, { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteVariant() {
    if (!variantToDelete?.id) return
    setDeleting(true)
    try {
      await deleteVariant(variantToDelete.id)
      setVariants((list) => list.filter((v) => v.key !== variantToDelete.key))
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Variação excluída.')
      setVariantToDelete(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Link
        to={product ? `/estoque/${product.id}` : '/estoque'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline"
      >
        <ArrowLeft className="size-4" /> {product ? product.name : 'Estoque'}
      </Link>
      <PageHeader
        title={editing ? 'Editar produto' : 'Novo produto'}
        description="Os campos com estrela são obrigatórios. O resto você pode completar depois."
      />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Dados do produto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[1fr_180px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome *" htmlFor="name" className="sm:col-span-2">
                <Input
                  id="name"
                  maxLength={200}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!skuTouched) setSku(suggestSku(e.target.value))
                  }}
                  placeholder="Ex.: Caneca de cerâmica branca 300ml"
                />
              </Field>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <label htmlFor="sku" className="text-sm font-medium">
                    SKU *
                  </label>
                  <Term
                    slug="sku"
                    term="SKU"
                    fallback="Código interno que você cria para identificar o produto. É ele que liga o anúncio do Mercado Livre ao estoque."
                  />
                </div>
                <Input
                  id="sku"
                  maxLength={60}
                  value={sku}
                  onChange={(e) => {
                    setSku(e.target.value.toUpperCase())
                    setSkuTouched(true)
                  }}
                  placeholder="CANECA-BRANCA-300"
                />
                <p className="text-xs text-muted-foreground">Use o mesmo SKU no anúncio do Mercado Livre.</p>
              </div>
              <Field
                label="Estoque mínimo"
                htmlFor="min-stock"
                hint="Avisamos quando chegar a esse número."
                help="Quantidade em que você quer ser avisado para repor o produto antes que acabe."
                helpTerm="Estoque mínimo"
              >
                <DecimalInput id="min-stock" decimals={0} value={minStock} onValueChange={setMinStock} />
              </Field>
              <Field label="Custo" htmlFor="cost" hint="Quanto você paga por unidade.">
                <DecimalInput id="cost" prefix="R$" value={cost} onValueChange={setCost} placeholder="0,00" />
              </Field>
              <Field label="Preço de venda" htmlFor="sale-price">
                <DecimalInput id="sale-price" prefix="R$" value={salePrice} onValueChange={setSalePrice} placeholder="0,00" />
              </Field>
              {!editing && !hasVariants && (
                <Field label="Estoque inicial" htmlFor="initial-stock" hint="Entra no histórico como “Estoque inicial”.">
                  <DecimalInput id="initial-stock" decimals={0} value={initialStock} onValueChange={setInitialStock} placeholder="0" />
                </Field>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Foto</p>
              <label className="group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted transition-colors hover:border-primary/60">
                {shownPhoto ? (
                  <img src={shownPhoto} alt="Foto do produto" className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                    <ImagePlus className="size-6" /> Escolher foto
                  </span>
                )}
                <input type="file" accept={PHOTO_TYPES.join(',')} className="sr-only" onChange={(e) => choosePhoto(e.target.files?.[0])} />
              </label>
              {shownPhoto && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setPhotoFile(null)
                    setPhotoPreview(null)
                    setRemovePhoto(true)
                  }}
                >
                  <X /> Remover foto
                </Button>
              )}
              <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP, até 5 MB.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variações</CardTitle>
            <CardDescription>Cores, tamanhos ou modelos do mesmo produto, cada um com seu estoque e SKU.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label htmlFor="has-variants" className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                id="has-variants"
                checked={hasVariants}
                disabled={product?.has_variants}
                onCheckedChange={(v) => {
                  setHasVariants(v === true)
                  if (v === true && variants.length === 0) setVariants([newDraft()])
                }}
              />
              Este produto tem variações (cor, tamanho…)
            </label>
            {convertingToVariants && (
              <Alert variant="warning">
                Este produto tem {product!.current_stock} unidade(s) em estoque. Ao salvar, esse estoque será zerado com um ajuste e passará a ser controlado em
                cada variação: informe o estoque inicial de cada uma abaixo.
              </Alert>
            )}
            {hasVariants && (
              <div className="space-y-3">
                {variants.map((v, index) => (
                  <div
                    key={v.key}
                    className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1.3fr_1fr_0.8fr_0.8fr_0.7fr_0.7fr_auto] sm:items-end"
                  >
                    <Field label="Variação" htmlFor={`v-name-${v.key}`}>
                      <Input
                        id={`v-name-${v.key}`}
                        value={v.name}
                        maxLength={120}
                        placeholder="Azul / M"
                        onChange={(e) => {
                          const patch: Partial<VariantDraft> = { name: e.target.value }
                          if (!v.id && (!v.sku || v.sku === suggestSku(`${sku} ${v.name}`, 40))) patch.sku = suggestSku(`${sku} ${e.target.value}`, 40)
                          updateDraft(v.key, patch)
                        }}
                      />
                    </Field>
                    <Field label="SKU" htmlFor={`v-sku-${v.key}`}>
                      <Input id={`v-sku-${v.key}`} value={v.sku} maxLength={60} onChange={(e) => updateDraft(v.key, { sku: e.target.value.toUpperCase() })} />
                    </Field>
                    <Field label="Custo" htmlFor={`v-cost-${v.key}`}>
                      <DecimalInput
                        id={`v-cost-${v.key}`}
                        prefix="R$"
                        value={v.cost}
                        onValueChange={(n) => updateDraft(v.key, { cost: n })}
                        placeholder="igual"
                      />
                    </Field>
                    <Field label="Preço" htmlFor={`v-price-${v.key}`}>
                      <DecimalInput
                        id={`v-price-${v.key}`}
                        prefix="R$"
                        value={v.salePrice}
                        onValueChange={(n) => updateDraft(v.key, { salePrice: n })}
                        placeholder="igual"
                      />
                    </Field>
                    <Field label="Mínimo" htmlFor={`v-min-${v.key}`}>
                      <DecimalInput id={`v-min-${v.key}`} decimals={0} value={v.minStock} onValueChange={(n) => updateDraft(v.key, { minStock: n })} />
                    </Field>
                    {v.id ? (
                      <div className="space-y-1.5 text-sm">
                        <p className="font-medium">Estoque</p>
                        <p className="tabular flex h-10 items-center text-muted-foreground">
                          {product?.product_variants.find((pv) => pv.id === v.id)?.current_stock ?? 0} un.
                        </p>
                      </div>
                    ) : (
                      <Field label="Estoque inicial" htmlFor={`v-stock-${v.key}`}>
                        <DecimalInput
                          id={`v-stock-${v.key}`}
                          decimals={0}
                          value={v.initialStock}
                          onValueChange={(n) => updateDraft(v.key, { initialStock: n })}
                          placeholder="0"
                        />
                      </Field>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover variação ${index + 1}`}
                      onClick={() => (v.id ? setVariantToDelete(v) : setVariants((list) => list.filter((d) => d.key !== v.key)))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Custo e preço vazios usam os valores do produto. O estoque de variações já salvas muda pela movimentação.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setVariants((list) => [...list, newDraft()])}>
                  <Plus /> Adicionar variação
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peso, medidas e observações</CardTitle>
            <CardDescription>Do produto já embalado. Ajudam a calcular o frete.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Peso" htmlFor="weight">
                <DecimalInput id="weight" suffix="g" decimals={0} value={weight} onValueChange={setWeight} />
              </Field>
              <Field label="Comprimento" htmlFor="length">
                <DecimalInput id="length" suffix="cm" decimals={1} value={length} onValueChange={setLength} />
              </Field>
              <Field label="Largura" htmlFor="width">
                <DecimalInput id="width" suffix="cm" decimals={1} value={width} onValueChange={setWidth} />
              </Field>
              <Field label="Altura" htmlFor="height">
                <DecimalInput id="height" suffix="cm" decimals={1} value={height} onValueChange={setHeight} />
              </Field>
            </div>
            <Field label="Observações" htmlFor="notes" optional>
              <Textarea
                id="notes"
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Fornecedor, cor da embalagem, cuidados…"
              />
            </Field>
          </CardContent>
        </Card>

        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="outline">
            <Link to={product ? `/estoque/${product.id}` : '/estoque'}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar produto'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(variantToDelete)}
        onOpenChange={(open) => !open && setVariantToDelete(null)}
        title="Excluir variação?"
        description={`“${variantToDelete?.name}” e todo o histórico de estoque dela serão apagados.`}
        confirmLabel="Excluir variação"
        destructive
        loading={deleting}
        onConfirm={confirmDeleteVariant}
      />
    </>
  )
}
