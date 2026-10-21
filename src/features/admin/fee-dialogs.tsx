import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { DecimalInput } from '@/components/common/decimal-input'
import { Field } from '@/components/common/field'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { errorMessage } from '@/lib/supabase'
import type { Category } from '../calculator/api'
import { todayInBrazil, type FeeRule, type ListingType, type ShippingMethod } from '../calculator/engine'
import { shippingOptions } from '../calculator/labels'
import { useReplaceFeeRule, useSaveCategory, type FeeRuleInput } from './api'

export type RuleDraft = Partial<FeeRule> & { rule_type: FeeRule['rule_type'] }

const blankRule = (draft: RuleDraft): FeeRuleInput => ({
  rule_type: draft.rule_type,
  category_id: draft.category_id ?? null,
  listing_type: draft.listing_type ?? null,
  shipping_methods: draft.shipping_methods ?? null,
  price_min: draft.price_min ?? null,
  price_max: draft.price_max ?? null,
  percent: draft.percent ?? null,
  amount: draft.amount ?? null,
  max_percent_of_price: draft.max_percent_of_price ?? null,
  valid_from: todayInBrazil(),
  valid_to: null,
  notes: null,
})

/** Nova tarifa com vigência. A regra equivalente em vigor é encerrada no dia anterior. */
export function RuleDialog({ draft, categories, onClose }: { draft: RuleDraft; categories: Category[]; onClose: () => void }) {
  const replace = useReplaceFeeRule()
  const [rule, setRule] = useState<FeeRuleInput>(() => blankRule(draft))
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof FeeRuleInput>(key: K, value: FeeRuleInput[K]) => setRule((r) => ({ ...r, [key]: value }))
  const isCommission = rule.rule_type === 'commission'

  function toggleMethod(method: ShippingMethod, on: boolean) {
    const current = rule.shipping_methods ?? []
    const next = on ? [...new Set([...current, method])] : current.filter((m) => m !== method)
    set('shipping_methods', next.length ? next : null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (isCommission) {
      if (!rule.category_id || !rule.listing_type) return setError('Escolha a categoria e o tipo de anúncio.')
      if (rule.percent == null || rule.percent < 0 || rule.percent >= 100) return setError('Informe a comissão entre 0% e 99%.')
    } else {
      if (rule.amount == null || rule.amount < 0) return setError('Informe o valor do custo fixo.')
      if (rule.price_min != null && rule.price_max != null && rule.price_max <= rule.price_min)
        return setError('O preço final da faixa precisa ser maior que o inicial.')
    }
    if (!rule.valid_from) return setError('Informe o início da vigência.')
    try {
      await replace.mutateAsync(rule)
      toast.success('Tarifa salva.')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isCommission ? 'Nova comissão' : 'Novo custo fixo'}</DialogTitle>
          <DialogDescription>
            A regra equivalente que estiver valendo será encerrada no dia anterior ao início desta. O histórico fica guardado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          {isCommission ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria" htmlFor="rule-category">
                <NativeSelect id="rule-category" value={rule.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}>
                  <option value="">Escolha</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Tipo de anúncio" htmlFor="rule-listing">
                <NativeSelect
                  id="rule-listing"
                  value={rule.listing_type ?? ''}
                  onChange={(e) => set('listing_type', (e.target.value || null) as ListingType | null)}
                >
                  <option value="">Escolha</option>
                  <option value="classico">Clássico</option>
                  <option value="premium">Premium</option>
                </NativeSelect>
              </Field>
              <Field label="Comissão" htmlFor="rule-percent">
                <DecimalInput id="rule-percent" suffix="%" decimals={3} value={rule.percent} onValueChange={(v) => set('percent', v)} />
              </Field>
            </div>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Formas de envio (nenhuma marcada = todas)</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {shippingOptions.map((o) => (
                    <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={rule.shipping_methods?.includes(o.value) ?? false} onCheckedChange={(v) => toggleMethod(o.value, v === true)} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Preço a partir de" htmlFor="rule-min" hint="Vazio = desde R$ 0">
                  <DecimalInput id="rule-min" prefix="R$" value={rule.price_min} onValueChange={(v) => set('price_min', v)} />
                </Field>
                <Field label="Preço abaixo de" htmlFor="rule-max" hint="Vazio = sem limite">
                  <DecimalInput id="rule-max" prefix="R$" value={rule.price_max} onValueChange={(v) => set('price_max', v)} />
                </Field>
                <Field label="Valor por unidade" htmlFor="rule-amount">
                  <DecimalInput id="rule-amount" prefix="R$" value={rule.amount} onValueChange={(v) => set('amount', v)} />
                </Field>
                <Field label="Limite (% do preço)" htmlFor="rule-cap" optional hint="Ex.: 50 = no máximo metade do preço">
                  <DecimalInput id="rule-cap" suffix="%" value={rule.max_percent_of_price} onValueChange={(v) => set('max_percent_of_price', v)} />
                </Field>
              </div>
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vale a partir de" htmlFor="rule-from">
              <Input id="rule-from" type="date" value={rule.valid_from} onChange={(e) => set('valid_from', e.target.value)} />
            </Field>
            <Field label="Vale até" htmlFor="rule-to" optional hint="Vazio = sem data para acabar">
              <Input id="rule-to" type="date" value={rule.valid_to ?? ''} onChange={(e) => set('valid_to', e.target.value || null)} />
            </Field>
          </div>
          <Field label="Observação" htmlFor="rule-notes" optional hint="Ex.: fonte da informação, data da conferência">
            <Textarea id="rule-notes" className="min-h-16" value={rule.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={replace.isPending}>
              {replace.isPending ? 'Salvando…' : 'Salvar tarifa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Cria/edita categoria. Na criação, já cadastra as comissões Clássico e Premium. */
export function CategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const saveCategory = useSaveCategory()
  const replace = useReplaceFeeRule()
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [mlCategory, setMlCategory] = useState(category?.ml_category_id ?? '')
  const [order, setOrder] = useState<number | null>(category?.sort_order ?? 500)
  const [active, setActive] = useState(category?.active ?? true)
  const [classico, setClassico] = useState<number | null>(null)
  const [premium, setPremium] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = saveCategory.isPending || replace.isPending

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Informe o nome da categoria.')
    if (!category && (classico == null || premium == null)) return setError('Informe as comissões do Clássico e do Premium.')
    try {
      const id = await saveCategory.mutateAsync({
        id: category?.id,
        name: name.trim(),
        description: description.trim() || null,
        ml_category_id: mlCategory.trim() || null,
        sort_order: order ?? 500,
        active,
      })
      if (!category) {
        for (const [listing_type, percent] of [
          ['classico', classico],
          ['premium', premium],
        ] as const) {
          await replace.mutateAsync({ ...blankRule({ rule_type: 'commission' }), category_id: id, listing_type, percent })
        }
      }
      toast.success('Categoria salva.')
      onClose()
    } catch (err) {
      setError(errorMessage(err).includes('categories_name_key') ? 'Já existe uma categoria com esse nome.' : errorMessage(err))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <Field label="Nome" htmlFor="cat-name">
            <Input id="cat-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Descrição" htmlFor="cat-desc" optional>
            <Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Id no Mercado Livre" htmlFor="cat-ml" optional hint="Ex.: MLB1574 (para a fase 2)">
              <Input id="cat-ml" value={mlCategory} onChange={(e) => setMlCategory(e.target.value)} />
            </Field>
            <Field label="Ordem na lista" htmlFor="cat-order">
              <DecimalInput id="cat-order" decimals={0} value={order} onValueChange={setOrder} />
            </Field>
          </div>
          {!category && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Comissão Clássico" htmlFor="cat-classico">
                <DecimalInput id="cat-classico" suffix="%" value={classico} onValueChange={setClassico} />
              </Field>
              <Field label="Comissão Premium" htmlFor="cat-premium">
                <DecimalInput id="cat-premium" suffix="%" value={premium} onValueChange={setPremium} />
              </Field>
            </div>
          )}
          <label htmlFor="cat-active" className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Ativa</span>
              <span className="text-muted-foreground">Inativa = some da lista da calculadora.</span>
            </span>
            <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
