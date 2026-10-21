import { InfoTip } from '@/components/common/info-tip'
import { useGlossary } from './api'

/**
 * Dica "o que é isso?" com a explicação do glossário (editável pelo admin).
 * Usa `fallback` enquanto o glossário carrega ou se o termo não existir.
 */
export function Term({ slug, fallback, term }: { slug: string; fallback: string; term: string }) {
  const { data } = useGlossary()
  const entry = data?.find((t) => t.slug === slug)
  return <InfoTip term={entry?.term ?? term}>{entry?.short_definition ?? fallback}</InfoTip>
}
