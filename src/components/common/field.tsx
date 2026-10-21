import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { InfoTip } from './info-tip'

interface FieldProps {
  label: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  /** Explicação do termo ("o que é isso?"). */
  help?: ReactNode
  helpTerm?: string
  optional?: boolean
  className?: string
  children: ReactNode
}

/** Rótulo + campo + dica/erro, com espaçamento padrão dos formulários. */
export function Field({ label, htmlFor, hint, error, help, helpTerm, optional, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>
          {label}
          {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
        </Label>
        {help && <InfoTip term={helpTerm ?? (typeof label === 'string' ? label : 'este campo')}>{help}</InfoTip>}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-foreground">
          <span className="mr-1 inline-block size-2 rounded-full bg-coral align-middle" aria-hidden />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
