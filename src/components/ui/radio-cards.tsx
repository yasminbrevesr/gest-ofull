import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface RadioCardOption<T extends string> {
  value: T
  label: ReactNode
  description?: ReactNode
}

interface RadioCardsProps<T extends string> {
  value: T | undefined
  onValueChange: (value: T) => void
  options: RadioCardOption<T>[]
  className?: string
  columns?: 2 | 3 | 4
  'aria-label'?: string
  'aria-labelledby'?: string
}

/** Escolha única em formato de cartões (ex.: Sim/Não, Clássico/Premium). */
function RadioCards<T extends string>({ value, onValueChange, options, className, columns = 2, ...aria }: RadioCardsProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      value={value ?? ''}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn(
        'grid gap-2',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
      {...aria}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className="flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border border-border bg-field px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:border-primary/60 data-[state=checked]:border-primary data-[state=checked]:bg-primary/12 data-[state=checked]:ring-1 data-[state=checked]:ring-primary"
        >
          <span className="font-semibold">{option.label}</span>
          {option.description && <span className="text-xs text-muted-foreground">{option.description}</span>}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  )
}

export { RadioCards }
