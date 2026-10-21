import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { errorMessage, invokeFunction } from '@/lib/supabase'
import { exchangeCode, type ImportSummary } from './api'
import { importMessage } from './ml-page'

type Step =
  | { state: 'connecting' }
  | { state: 'importing'; nickname: string }
  | { state: 'done'; nickname: string; summary: string }
  | { state: 'error'; message: string }

/** Retorno do Mercado Livre depois da autorização (?code=…&state=…). */
export default function ConnectedPage() {
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>({ state: 'connecting' })
  const started = useRef(false)

  useEffect(() => {
    // Evita trocar o mesmo código duas vezes (o React chama efeitos duas vezes em modo de desenvolvimento).
    if (started.current) return
    started.current = true
    const code = params.get('code')
    const state = params.get('state')
    const denied = params.get('error')

    async function run() {
      if (denied || !code || !state) {
        setStep({
          state: 'error',
          message:
            denied === 'access_denied'
              ? 'Você não autorizou o acesso no Mercado Livre.'
              : 'O Mercado Livre não devolveu a autorização. Tente conectar de novo.',
        })
        return
      }
      try {
        const { nickname } = await exchangeCode(code, state)
        setStep({ state: 'importing', nickname })
        await queryClient.invalidateQueries({ queryKey: ['ml-connection'] })
        try {
          const summary = await invokeFunction<ImportSummary>('ml-import-listings')
          setStep({ state: 'done', nickname, summary: importMessage(summary) })
        } catch (err) {
          setStep({
            state: 'done',
            nickname,
            summary: `Não foi possível importar os anúncios agora (${errorMessage(err)}). Tente pelo botão “Importar anúncios”.`,
          })
        }
        await queryClient.invalidateQueries({ queryKey: ['ml-listings'] })
      } catch (err) {
        setStep({ state: 'error', message: errorMessage(err) })
      }
    }
    run()
  }, [params, queryClient])

  return (
    <Card className="mx-auto mt-6 max-w-lg space-y-4 p-6 text-center sm:p-8">
      {step.state === 'connecting' || step.state === 'importing' ? (
        <>
          <div className="mx-auto size-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary" role="status" />
          <p className="font-display text-xl font-semibold">
            {step.state === 'connecting' ? 'Conectando sua conta…' : `Conta ${step.nickname} conectada! Importando anúncios…`}
          </p>
          <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos. Não feche esta página.</p>
        </>
      ) : step.state === 'done' ? (
        <>
          <CircleCheck className="mx-auto size-12 text-primary-text" />
          <p className="font-display text-xl font-semibold">Conta {step.nickname} conectada!</p>
          <p className="text-sm">{step.summary}</p>
          <Button asChild>
            <Link to="/mercado-livre">Ver anúncios e vínculos</Link>
          </Button>
        </>
      ) : (
        <>
          <CircleAlert className="mx-auto size-12" />
          <p className="font-display text-xl font-semibold">Não foi possível conectar</p>
          <p className="text-sm">{step.message}</p>
          <Button asChild>
            <Link to="/mercado-livre">Tentar de novo</Link>
          </Button>
        </>
      )}
    </Card>
  )
}
