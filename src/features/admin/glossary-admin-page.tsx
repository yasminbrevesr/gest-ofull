import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Field } from '@/components/common/field'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { errorMessage } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { useGlossary, type GlossaryTerm } from '../glossary/api'
import { useDeleteGlossaryTerm, useSaveGlossaryTerm } from './api'

export default function GlossaryAdminPage() {
  const glossary = useGlossary()
  const remove = useDeleteGlossaryTerm()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<GlossaryTerm | 'novo' | null>(null)
  const [toDelete, setToDelete] = useState<GlossaryTerm | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (glossary.data ?? []).filter((t) => !q || `${t.term} ${t.slug}`.toLowerCase().includes(q))
  }, [glossary.data, query])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" placeholder="Buscar termo" aria-label="Buscar termo" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button onClick={() => setEditing('novo')}>
          <Plus /> Novo termo
        </Button>
      </div>
      {glossary.isLoading ? (
        <LoadingState rows={6} />
      ) : glossary.error ? (
        <ErrorState error={glossary.error} onRetry={() => glossary.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum termo" />
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((t) => (
            <div key={t.id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-semibold">
                  {t.term} <span className="text-xs font-normal text-muted-foreground">({t.slug})</span>
                </p>
                <p className="text-sm text-muted-foreground">{t.short_definition}</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Editar ${t.term}`} onClick={() => setEditing(t)}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${t.term}`} onClick={() => setToDelete(t)}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </Card>
      )}

      {editing && <TermDialog term={editing === 'novo' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir termo?"
        description={`“${toDelete?.term}” sai do glossário e das dicas do app.`}
        confirmLabel="Excluir"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(toDelete!.id)
            toast.success('Termo excluído.')
            setToDelete(null)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </div>
  )
}

function TermDialog({ term, onClose }: { term: GlossaryTerm | null; onClose: () => void }) {
  const save = useSaveGlossaryTerm()
  const [name, setName] = useState(term?.term ?? '')
  const [slug, setSlug] = useState(term?.slug ?? '')
  const [definition, setDefinition] = useState(term?.short_definition ?? '')
  const [details, setDetails] = useState(term?.details ?? '')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim() || !slug || !definition.trim()) return setError('Preencha termo, identificador e explicação curta.')
    try {
      await save.mutateAsync({ id: term?.id, term: name.trim(), slug, short_definition: definition.trim(), details: details.trim() || null })
      toast.success('Termo salvo.')
      onClose()
    } catch (err) {
      setError(errorMessage(err).includes('glossary_terms_slug_key') ? 'Já existe um termo com esse identificador.' : errorMessage(err))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{term ? 'Editar termo' : 'Novo termo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Termo" htmlFor="term-name">
              <Input
                id="term-name"
                maxLength={80}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!term) setSlug(slugify(e.target.value))
                }}
              />
            </Field>
            <Field label="Identificador" htmlFor="term-slug" hint="Usado pelas dicas do app. Evite mudar.">
              <Input id="term-slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
            </Field>
          </div>
          <Field label="Explicação curta" htmlFor="term-definition" hint={`${definition.length}/400 — aparece no “o que é isso?”.`}>
            <Textarea id="term-definition" maxLength={400} value={definition} onChange={(e) => setDefinition(e.target.value)} />
          </Field>
          <Field label="Explicação completa" htmlFor="term-details" optional hint="Aparece só na página do glossário. Aceita markdown.">
            <Textarea id="term-details" value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
