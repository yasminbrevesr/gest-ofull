import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      success: 'bg-success text-primary-foreground',
      warning: 'bg-butter text-on-accent',
      danger: 'bg-coral text-on-accent',
      rose: 'bg-rose text-on-accent',
      muted: 'bg-muted text-muted-foreground',
      outline: 'border border-border text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
