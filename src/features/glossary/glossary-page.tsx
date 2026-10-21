import { BookOpen, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Markdown } from '@/components/common/markdown'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useGlossary } from './api'

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function GlossaryPage() {
  const glossary = useGlossary()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return glossary.data ?? []
    return (glossary.data ?? []).filter((t) => normalize(`${t.term} ${t.short_definition}`).includes(q))
  }, [glossary.data, query])

  return (
    <>
      <PageHeader
        title={
          <>
            Glossário do <Highlight>vendedor</Highlight>
          </>
        }
        description="Os termos do Mercado Livre explicados sem complicação."
      />
      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder="Buscar termo (ex.: Full, SKU, reputação)"
          aria-label="Buscar termo"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {glossary.isLoading ? (
        <LoadingState rows={6} />
      ) : glossary.error ? (
        <ErrorState error={glossary.error} onRetry={() => glossary.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<BookOpen />} title="Nenhum termo encontrado" description={query ? 'Tente outra palavra.' : undefined} />
      ) : (
        <dl className="grid gap-3 md:grid-cols-2">
          {filtered.map((t) => (
            <Card key={t.id} id={t.slug} className="scroll-mt-24 space-y-1.5 p-4">
              <dt className="font-serif text-lg font-semibold">{t.term}</dt>
              <dd className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>{t.short_definition}</p>
                {t.details && <Markdown className="text-foreground">{t.details}</Markdown>}
              </dd>
            </Card>
          ))}
        </dl>
      )}
    </>
  )
}
