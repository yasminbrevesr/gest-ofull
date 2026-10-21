import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { DecimalInput } from '@/components/common/decimal-input'
import { Field } from '@/components/common/field'
import { Markdown } from '@/components/common/markdown'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import type { GuideLink, GuideStep } from '../journey/progress'
import { useAllGuideSteps, useSaveGuideStep } from './api'

const flagOptions: { value: GuideStep['onboarding_flag'] | ''; label: string }[] = [
  { value: '', label: 'Nenhuma' },
  { value: 'has_ml_account', label: 'Já tem conta no Mercado Livre' },
  { value: 'has_cnpj', label: 'Já tem CNPJ' },
  { value: 'has_products', label: 'Já tem produtos' },
]

export default function StepEditorPage() {
  const { id } = useParams()
  const steps = useAllGuideSteps()
  if (steps.isLoading) return <LoadingState rows={6} />
  if (steps.error) return <ErrorState error={steps.error} onRetry={() => steps.refetch()} />
  const step = id && id !== 'nova' ? steps.data!.find((s) => s.id === id) : null
  if (id && id !== 'nova' && !step) return <EmptyState title="Etapa não encontrada" />
  const nextPosition = (steps.data!.at(-1)?.position ?? 0) + 10
  return <StepEditor key={step?.id ?? 'nova'} step={step ?? null} nextPosition={nextPosition} />
}

function StepEditor({ step, nextPosition }: { step: GuideStep | null; nextPosition: number }) {
  const navigate = useNavigate()
  const save = useSaveGuideStep()
  const [title, setTitle] = useState(step?.title ?? '')
  const [slug, setSlug] = useState(step?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(step))
  const [summary, setSummary] = useState(step?.summary ?? '')
  const [content, setContent] = useState(step?.content ?? '')
  const [links, setLinks] = useState<GuideLink[]>(step?.links ?? [])
  const [minutes, setMinutes] = useState<number | null>(step?.estimated_minutes ?? null)
  const [flag, setFlag] = useState<GuideStep['onboarding_flag'] | ''>(step?.onboarding_flag ?? '')
  const [published, setPublished] = useState(step?.published ?? false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!title.trim() || !slug.trim() || !summary.trim() || !content.trim()) return setError('Preencha título, endereço, resumo e conteúdo.')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return setError('O endereço só pode ter letras minúsculas, números e hífen (ex.: primeiro-anuncio).')
    const cleanLinks = links.filter((l) => l.label.trim() || l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
    if (cleanLinks.some((l) => !l.label || !(l.url.startsWith('https://') || l.url.startsWith('/')))) {
      return setError('Cada link precisa de um texto e de um endereço começando com https:// (ou / para páginas do app).')
    }
    if (minutes != null && (!Number.isInteger(minutes) || minutes <= 0)) return setError('O tempo estimado precisa ser um número inteiro de minutos.')
    try {
      await save.mutateAsync({
        id: step?.id,
        title: title.trim(),
        slug,
        summary: summary.trim(),
        content,
        links: cleanLinks,
        estimated_minutes: minutes,
        onboarding_flag: flag || null,
        published,
        ...(step ? {} : { position: nextPosition }),
      })
      toast.success('Etapa salva.')
      navigate('/admin/jornada')
    } catch (err) {
      setError(errorMessage(err).includes('guide_steps_slug_key') ? 'Já existe uma etapa com esse endereço.' : errorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Link to="/admin/jornada" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline">
        <ArrowLeft className="size-4" /> Etapas
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{step ? 'Editar etapa' : 'Nova etapa'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Título" htmlFor="step-title" className="md:col-span-2">
            <Input
              id="step-title"
              maxLength={120}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
            />
          </Field>
          <Field label="Endereço" htmlFor="step-slug" hint={`A etapa abre em /jornada/${slug || '…'}`}>
            <Input
              id="step-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase())
                setSlugTouched(true)
              }}
            />
          </Field>
          <Field label="Tempo estimado" htmlFor="step-minutes" optional>
            <DecimalInput id="step-minutes" decimals={0} suffix="min" value={minutes} onValueChange={setMinutes} />
          </Field>
          <Field label="Resumo" htmlFor="step-summary" hint={`${summary.length}/300 — aparece no cartão da trilha.`} className="md:col-span-2">
            <Textarea id="step-summary" maxLength={300} className="min-h-16" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
          <Field
            label="Quem provavelmente já fez"
            htmlFor="step-flag"
            hint="Pela resposta do cadastro inicial: a etapa aparece como “você já deve ter feito” e não é sugerida como próxima."
          >
            <NativeSelect id="step-flag" value={flag ?? ''} onChange={(e) => setFlag(e.target.value as GuideStep['onboarding_flag'] | '')}>
              {flagOptions.map((o) => (
                <option key={o.value ?? ''} value={o.value ?? ''}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <label
            htmlFor="step-published"
            className="flex cursor-pointer items-center justify-between gap-3 self-end rounded-lg border border-border p-3 text-sm"
          >
            <span>
              <span className="block font-medium">Publicada</span>
              <span className="text-muted-foreground">Desligada = rascunho, só admins veem.</span>
            </span>
            <Switch id="step-published" checked={published} onCheckedChange={setPublished} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conteúdo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Formatação: <code>## Título</code>, <code>**negrito**</code>, listas com <code>-</code> ou <code>1.</code>, <code>&gt; destaque</code>, links{' '}
            <code>[texto](https://…)</code> e tabelas.
          </p>
          <Tabs defaultValue="editar" className="lg:hidden">
            <TabsList>
              <TabsTrigger value="editar">Editar</TabsTrigger>
              <TabsTrigger value="ver">Pré-visualizar</TabsTrigger>
            </TabsList>
            <TabsContent value="editar">
              <Textarea aria-label="Conteúdo em markdown" className="min-h-96 font-mono text-xs" value={content} onChange={(e) => setContent(e.target.value)} />
            </TabsContent>
            <TabsContent value="ver">
              <div className="rounded-lg border border-border p-4">
                <Markdown>{content || '_Nada para mostrar ainda._'}</Markdown>
              </div>
            </TabsContent>
          </Tabs>
          <div className="hidden gap-4 lg:grid lg:grid-cols-2">
            <Textarea
              aria-label="Conteúdo em markdown"
              className="min-h-[32rem] font-mono text-xs"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-border p-4">
              <Markdown>{content || '_Nada para mostrar ainda._'}</Markdown>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links oficiais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {links.map((link, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
              <Input
                aria-label="Texto do link"
                placeholder="Texto (ex.: Portal do Empreendedor)"
                value={link.label}
                onChange={(e) => setLinks(links.map((l, i) => (i === index ? { ...l, label: e.target.value } : l)))}
              />
              <Input
                aria-label="Endereço do link"
                placeholder="https://…"
                value={link.url}
                onChange={(e) => setLinks(links.map((l, i) => (i === index ? { ...l, url: e.target.value } : l)))}
              />
              <Button type="button" variant="ghost" size="icon" aria-label="Remover link" onClick={() => setLinks(links.filter((_, i) => i !== index))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setLinks([...links, { label: '', url: '' }])}>
            <Plus /> Adicionar link
          </Button>
        </CardContent>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link to="/admin/jornada">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar etapa'}
        </Button>
      </div>
    </form>
  )
}
