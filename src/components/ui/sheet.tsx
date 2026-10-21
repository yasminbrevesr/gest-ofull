import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetTitle = SheetPrimitive.Title

/** Painel lateral (menu no celular). */
function SheetContent({ className, children, ...props }: ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65" />
      <SheetPrimitive.Content
        className={cn('fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-lg', className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 cursor-pointer rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <XIcon className="size-5" />
          <span className="sr-only">Fechar menu</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle }
