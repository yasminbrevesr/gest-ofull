import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, CircleAlert, Info, Lightbulb } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const alertVariants = cva('flex gap-3 rounded-lg border p-4 text-sm leading-relaxed [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0', {
  variants: {
    variant: {
      info: 'border-primary/30 bg-primary/10 text-foreground [&>svg]:text-primary-text',
      warning: 'border-butter/40 bg-butter/10 text-foreground [&>svg]:text-butter-text',
      danger: 'border-coral/45 bg-coral/12 text-foreground [&>svg]:text-coral-text',
      tip: 'border-rose/40 bg-rose/10 text-foreground [&>svg]:text-rose-text',
    },
  },
  defaultVariants: { variant: 'info' },
})

const icons = { info: Info, warning: AlertTriangle, danger: CircleAlert, tip: Lightbulb }

type AlertProps = Omit<ComponentProps<'div'>, 'title'> & VariantProps<typeof alertVariants> & { title?: ReactNode }

function Alert({ className, variant = 'info', title, children, ...props }: AlertProps) {
  const Icon = icons[variant ?? 'info']
  return (
    <div role={variant === 'danger' ? 'alert' : 'status'} className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}

export { Alert }
