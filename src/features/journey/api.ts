import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { GuideStep } from './progress'

export function useGuideSteps() {
  return useQuery({
    queryKey: ['guide-steps'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('guide_steps').select('*').eq('published', true).order('position')
      if (error) throw error
      return data as GuideStep[]
    },
  })
}

/** Ids das etapas que o usuário marcou como concluídas. */
export function useGuideProgress() {
  return useQuery({
    queryKey: ['guide-progress'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_guide_progress').select('step_id, created_at')
      if (error) throw error
      return new Map((data as { step_id: string; created_at: string }[]).map((row) => [row.step_id, row.created_at]))
    },
  })
}

export function useToggleStep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ stepId, done }: { stepId: string; done: boolean }) => {
      const { error } = done
        ? await supabase.from('user_guide_progress').upsert({ step_id: stepId }, { onConflict: 'user_id,step_id', ignoreDuplicates: true })
        : await supabase.from('user_guide_progress').delete().eq('step_id', stepId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guide-progress'] }),
  })
}
