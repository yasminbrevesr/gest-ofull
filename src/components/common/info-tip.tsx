import { CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface InfoTipProps {
  /** Texto curto explicando o termo. */
  children: ReactNode
  /** Nome do termo, usado no leitor de tela ("O que é custo fixo?"). */
  term: string
}

/** Ícone "o que é isso?" que abre uma explicação curta (funciona com toque no celular). */
export function InfoTip({ children, term }: InfoTipProps) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:text-primary-text"
        aria-label={`O que é ${term}?`}
      >
        <CircleHelp className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="space-y-1.5 leading-relaxed">
        <p className="font-semibold">{term}</p>
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  )
}
