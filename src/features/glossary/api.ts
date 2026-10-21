import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface GlossaryTerm {
  id: string
  slug: string
  term: string
  short_definition: string
  details: string | null
  updated_at: string
}

export function useGlossary() {
  return useQuery({
    queryKey: ['glossary'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('glossary_terms').select('*').order('term')
      if (error) throw error
      return data as GlossaryTerm[]
    },
  })
}
