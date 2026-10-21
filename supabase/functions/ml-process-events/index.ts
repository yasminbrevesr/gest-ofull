// Processa a fila de eventos. Chamada pelo agendador a cada minuto (todos os
// usuários) ou pelo app depois de "Reprocessar" (só os eventos do usuário).
import { processQueue } from '../_shared/events.ts'
import { json, serve } from '../_shared/http.ts'
import { adminClient, requireUserOrCron } from '../_shared/supabase.ts'

serve('ml-process-events', async (req) => {
  const admin = adminClient()
  const { userId } = await requireUserOrCron(req, admin)
  const result = await processQueue(admin, { userId, limit: userId ? 20 : 40, budgetMs: userId ? 25_000 : 50_000 })
  return json(result)
})
