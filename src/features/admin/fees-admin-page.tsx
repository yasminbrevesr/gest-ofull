import { CalendarCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DecimalInput } from '@/components/common/decimal-input'
import { Field } from '@/components/common/field'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate, formatPercent } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import type { AppSettings, Category } from '../calculator/api'
import { isRuleActive, todayInBrazil, type FeeRule } from '../calculator/engine'
import { listingTypeLabels, shippingLabels } from '../calculator/labels'
import { useDeleteFeeRule, useFeesAdmin, useSaveSettings, type FeesAdminData } from './api'
import { CategoryDialog, RuleDialog, type RuleDraft } from './fee-dialogs'

type RuleState = 'active' | 'future' | 'ended'

function ruleState(rule: FeeRule, today: string): RuleState {
  if (isRuleActive(rule, today)) return 'active'
  return rule.valid_from > today ? 'future' : 'ended'
}

const stateBadge = { active: ['success', 'Vigente'], future: ['warning', 'Futura'], ended: ['muted', 'Encerrada'] } as const

function priceRange(rule: FeeRule) {
  if (rule.price_min == null && rule.price_max == null) return 'Qualquer preço'
  if (rule.price_min == null || rule.price_min === 0) return `Abaixo de ${formatCurrency(rule.price_max)}`
  if (rule.price_max == null) return `A partir de ${formatCurrency(rule.price_min)}`
  return `${formatCurrency(rule.price_min)} a ${formatCurrency(rule.price_max - 0.01)}`
}

const methodsText = (rule: FeeRule) => (rule.shipping_methods?.length ? rule.shipping_methods.map((m) => shippingLabels[m]).join(', ') : 'Todas')

export default function FeesAdminPage() {
  const data = useFeesAdmin()
  if (data.isLoading) return <LoadingState rows={6} />
  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />
  return <FeesAdmin data={data.data!} />
}

function FeesAdmin({ data }: { data: FeesAdminData }) {
  const today = todayInBrazil()
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null)
  const [category, setCategory] = useState<Category | 'nova' | null>(null)

  return (
    <div className="space-y-6">
      <SettingsCard key={JSON.stringify(data.settings)} settings={data.settings} />
      <CommissionsCard data={data} today={today} onNewRule={setRuleDraft} onEditCategory={setCategory} />
      <FixedFeesCard rules={data.rules} today={today} onNewRule={setRuleDraft} />
      <HistoryCard data={data} today={today} />
      {ruleDraft && <RuleDialog draft={ruleDraft} categories={data.categories} onClose={() => setRuleDraft(null)} />}
      {category && <CategoryDialog category={category === 'nova' ? null : category} onClose={() => setCategory(null)} />}
    </div>
  )
}

function SettingsCard({ settings }: { settings: AppSettings }) {
  const save = useSaveSettings()
  const [reviewed, setReviewed] = useState(settings.fees_reviewed_on ?? '')
  const [url, setUrl] = useState(settings.fees_source_url)
  const [margin, setMargin] = useState<number | null>(settings.margin_healthy_pct)

  async function submit(event: FormEvent, override?: string) {
    event.preventDefault()
    if (!url.startsWith('https://')) return toast.error('O link precisa começar com https://')
    if (margin == null || margin < 0 || margin > 100) return toast.error('A margem saudável precisa estar entre 0% e 100%.')
    try {
      await save.mutateAsync({ fees_reviewed_on: (override ?? reviewed) || null, fees_source_url: url, margin_healthy_pct: margin })
      toast.success('Configurações salvas.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conferência das tarifas</CardTitle>
        <CardDescription>
          A calculadora mostra “Valores de referência, atualizados em …” com a data abaixo. Atualize sempre que conferir as tarifas na página oficial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => submit(e)} className="grid gap-4 md:grid-cols-[180px_1fr_160px] md:items-start">
          <Field label="Conferidas em" htmlFor="reviewed-on" hint={reviewed ? undefined : 'Vazio = “ainda não conferidos”'}>
            <Input id="reviewed-on" type="date" value={reviewed} onChange={(e) => setReviewed(e.target.value)} />
          </Field>
          <Field label="Página oficial de tarifas" htmlFor="source-url">
            <Input id="source-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Field label="Margem saudável" htmlFor="healthy" hint="Abaixo dela: apertada">
            <DecimalInput id="healthy" suffix="%" value={margin} onValueChange={setMargin} />
          </Field>
          <div className="flex flex-wrap gap-2 md:col-span-3">
            <Button type="submit" disabled={save.isPending}>
              Salvar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={(e) => {
                const today = todayInBrazil()
                setReviewed(today)
                submit(e, today)
              }}
            >
              <CalendarCheck /> Conferi hoje
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function CommissionsCard({
  data,
  today,
  onNewRule,
  onEditCategory,
}: {
  data: FeesAdminData
  today: string
  onNewRule: (draft: RuleDraft) => void
  onEditCategory: (category: Category | 'nova') => void
}) {
  const current = (categoryId: string, type: 'classico' | 'premium') =>
    data.rules
      .filter((r) => r.rule_type === 'commission' && r.category_id === categoryId && r.listing_type === type && isRuleActive(r, today))
      .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0]
  const upcoming = (categoryId: string) => data.rules.filter((r) => r.rule_type === 'commission' && r.category_id === categoryId && r.valid_from > today)

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Comissões por categoria</CardTitle>
          <CardDescription>Percentual cobrado sobre o preço de venda, vigente hoje.</CardDescription>
        </div>
        <Button size="sm" onClick={() => onEditCategory('nova')}>
          <Plus /> Nova categoria
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Clássico</TableHead>
              <TableHead className="text-right">Premium</TableHead>
              <TableHead>Próxima mudança</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.categories.map((c) => {
              const classico = current(c.id, 'classico')
              const premium = current(c.id, 'premium')
              const next = upcoming(c.id)
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-medium">{c.name}</span> {!c.active && <Badge variant="muted">Inativa</Badge>}
                  </TableCell>
                  <TableCell className="tabular text-right">{classico ? formatPercent(classico.percent, 2) : '—'}</TableCell>
                  <TableCell className="tabular text-right">{premium ? formatPercent(premium.percent, 2) : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {next.length
                      ? next.map((r) => `${listingTypeLabels[r.listing_type!]} ${formatPercent(r.percent, 2)} em ${formatDate(r.valid_from)}`).join('; ')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => onNewRule({ rule_type: 'commission', category_id: c.id, listing_type: 'classico', percent: classico?.percent ?? null })}
                      >
                        Alterar comissão
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Editar ${c.name}`} onClick={() => onEditCategory(c)}>
                        <Pencil />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function FixedFeesCard({ rules, today, onNewRule }: { rules: FeeRule[]; today: string; onNewRule: (draft: RuleDraft) => void }) {
  const active = rules.filter((r) => r.rule_type === 'fixed_fee' && isRuleActive(r, today)).sort((a, b) => (a.price_min ?? 0) - (b.price_min ?? 0))
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Custo fixo por unidade</CardTitle>
          <CardDescription>
            Faixas de preço vigentes hoje. Custo de envio (Full, Coleta, Agência e acima de R$ 79) é informado pelo usuário na calculadora.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => onNewRule({ rule_type: 'fixed_fee', shipping_methods: ['flex', 'proprio'] })}>
          <Plus /> Nova faixa
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Formas de envio</TableHead>
              <TableHead>Faixa de preço</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Limite</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{methodsText(r)}</TableCell>
                <TableCell>{priceRange(r)}</TableCell>
                <TableCell className="tabular text-right">{formatCurrency(r.amount)}</TableCell>
                <TableCell>{r.max_percent_of_price != null ? `até ${formatPercent(r.max_percent_of_price, 0)} do preço` : '—'}</TableCell>
                <TableCell>{formatDate(r.valid_from)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="soft" onClick={() => onNewRule({ ...r, valid_to: null })}>
                    Alterar valor
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function HistoryCard({ data, today }: { data: FeesAdminData; today: string }) {
  const remove = useDeleteFeeRule()
  const [filter, setFilter] = useState<'todas' | RuleState>('todas')
  const [toDelete, setToDelete] = useState<FeeRule | null>(null)
  const categoryName = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories])
  const rows = data.rules.filter((r) => filter === 'todas' || ruleState(r, today) === filter)

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Histórico de tarifas</CardTitle>
          <CardDescription>Todas as regras, inclusive as encerradas e as que ainda vão começar.</CardDescription>
        </div>
        <NativeSelect aria-label="Filtrar" className="w-40" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="todas">Todas</option>
          <option value="active">Vigentes</option>
          <option value="future">Futuras</option>
          <option value="ended">Encerradas</option>
        </NativeSelect>
      </CardHeader>
      <CardContent>
        <div className="max-h-[28rem] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regra</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const [variant, label] = stateBadge[ruleState(r, today)]
                return (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-80">
                      {r.rule_type === 'commission' ? (
                        <>
                          Comissão {listingTypeLabels[r.listing_type!]} · {categoryName.get(r.category_id!) ?? '—'}
                        </>
                      ) : (
                        <>
                          Custo fixo · {methodsText(r)} · {priceRange(r)}
                        </>
                      )}
                      {r.notes && <span className="block text-xs text-muted-foreground">{r.notes}</span>}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {r.rule_type === 'commission' ? formatPercent(r.percent, 2) : formatCurrency(r.amount)}
                      {r.max_percent_of_price != null && (
                        <span className="block text-xs text-muted-foreground">máx. {formatPercent(r.max_percent_of_price, 0)}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(r.valid_from)} → {r.valid_to ? formatDate(r.valid_to) : 'sem fim'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={variant}>{label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon-sm" variant="ghost" aria-label="Excluir regra" onClick={() => setToDelete(r)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir regra?"
        description="Use só para corrigir um cadastro errado. Para mudar uma tarifa, crie uma nova regra com a data de início: o histórico fica guardado."
        confirmLabel="Excluir"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(toDelete!.id)
            toast.success('Regra excluída.')
            setToDelete(null)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </Card>
  )
}
