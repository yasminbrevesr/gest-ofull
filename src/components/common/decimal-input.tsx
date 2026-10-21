import { useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { parseDecimal, toInputText } from '@/lib/format'
import { cn } from '@/lib/utils'

type DecimalInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'prefix'> & {
  value: number | null
  onValueChange: (value: number | null) => void
  /** Texto fixo antes do número, ex.: "R$". */
  prefix?: string
  /** Texto fixo depois do número, ex.: "%" ou "g". */
  suffix?: string
  decimals?: number
}

/**
 * Campo numérico no padrão brasileiro: aceita "12,50" ou "1.234,56".
 * Guarda o texto digitado e devolve o número já convertido.
 */
export function DecimalInput({ value, onValueChange, prefix, suffix, decimals = 2, className, onBlur, ...props }: DecimalInputProps) {
  const [text, setText] = useState(() => toInputText(value, decimals))
  const [lastValue, setLastValue] = useState(value)

  // Valor alterado por fora (ex.: preço sugerido aplicado): reflete no campo.
  if (value !== lastValue) {
    setLastValue(value)
    if (parseDecimal(text) !== value) setText(toInputText(value, decimals))
  }

  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        className={cn('tabular', prefix && 'pl-10', suffix && 'pr-10', className)}
        onChange={(event) => {
          setText(event.target.value)
          const parsed = parseDecimal(event.target.value)
          setLastValue(parsed)
          onValueChange(parsed)
        }}
        onBlur={(event) => {
          const parsed = parseDecimal(text)
          if (parsed != null) setText(toInputText(parsed, decimals))
          onBlur?.(event)
        }}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  )
}
