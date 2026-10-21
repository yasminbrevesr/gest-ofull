import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      success: 'border tint-success',
      warning: 'border tint-warning',
      danger: 'border tint-danger',
      rose: 'border tint-rose',
      muted: 'border tint-muted',
      outline: 'border border-border text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
