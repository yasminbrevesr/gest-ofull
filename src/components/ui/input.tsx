import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-coral aria-invalid:ring-2 aria-invalid:ring-coral/40'

function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input type={type} className={cn(fieldBase, 'h-10 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold', className)} {...props} />
  )
}

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldBase, 'min-h-24 py-2 leading-relaxed', className)} {...props} />
}

/** Select nativo: acessível e confortável no celular. */
function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-10 cursor-pointer appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237A7A7A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { Input, Textarea, NativeSelect, fieldBase }
