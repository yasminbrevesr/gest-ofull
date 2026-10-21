import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { DecimalInput } from '@/components/common/decimal-input'
import { Field } from '@/components/common/field'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, NativeSelect } from '@/components/ui/input'
import { RadioCards } from '@/components/ui/radio-cards'
import { errorMessage } from '@/lib/supabase'
import { useRegisterMovement } from './api'
import type { MovementType, Product } from './types'

const typeOptions: { value: MovementType; label: string; description: string }[] = [
  { value: 'entrada', label: 'Entrada', description: 'Chegou mercadoria' },
  { value: 'saida', label: 'Saída', description: 'Perda, brinde, envio ao Full…' },
  { value: 'venda', label: 'Venda', description: 'Vendeu fora do Mercado Livre' },
  { value: 'ajuste', label: 'Ajuste', description: 'Contei e o número é outro' },
]

const reasonHints: Record<MovementType, string> = {
  entrada: 'Ex.: compra do fornecedor, devolução de cliente',
  saida: 'Ex.: produto com defeito, enviado para o Full',
  venda: 'Ex.: venda no Instagram, feira',
  ajuste: 'Ex.: contagem do estoque',
}

interface MovementDialogProps {
  product: Product
  initialVariantId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Registrar entrada, saída, venda ou ajuste. O saldo é recalculado pelo banco. */
export function MovementDialog({ product, initialVariantId, open, onOpenChange }: MovementDialogProps) {
  const register = useRegisterMovement()
  const [type, setType] = useState<MovementType>('entrada')
  const [variantId, setVariantId] = useState<string>(initialVariantId ?? product.product_variants[0]?.id ?? '')
  const [quantity, setQuantity] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const variant = product.has_variants ? product.product_variants.find((v) => v.id === variantId) : null
  const current = product.has_variants ? (variant?.current_stock ?? 0) : product.current_stock
  const after = quantity == null ? null : type === 'ajuste' ? quantity : type === 'entrada' ? current + quantity : current - quantity

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (product.has_variants && !variant) return setError('Escolha a variação.')
    if (quantity == null || !Number.isInteger(quantity) || quantity < 0 || (type !== 'ajuste' && quantity === 0)) {
      return setError(type === 'ajuste' ? 'Informe quantas unidades você contou (pode ser 0).' : 'Informe uma quantidade inteira maior que zero.')
    }
    try {
      await register.mutateAsync({ productId: product.id, variantId: variant?.id ?? null, type, quantity, reason })
      toast.success('Movimentação registrada.')
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar movimentação</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="space-y-2">
            <p id="movement-type" className="text-sm font-medium">
              O que aconteceu?
            </p>
            <RadioCards aria-labelledby="movement-type" columns={2} value={type} onValueChange={setType} options={typeOptions} />
          </div>
          {product.has_variants && (
            <Field label="Variação" htmlFor="movement-variant">
              <NativeSelect id="movement-variant" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                {product.product_variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.sku}) — {v.current_stock} un.
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={type === 'ajuste' ? 'Estoque contado' : 'Quantidade'}
              htmlFor="movement-quantity"
              hint={type === 'ajuste' ? 'Quantas unidades existem de verdade.' : 'Em unidades.'}
            >
              <DecimalInput id="movement-quantity" decimals={0} value={quantity} onValueChange={setQuantity} autoFocus />
            </Field>
            <div className="flex items-center gap-3 self-end rounded-lg bg-muted px-4 py-2.5 text-sm">
              <span>
                Atual: <strong className="tabular">{current}</strong>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              <span>
                Depois: <strong className={`tabular ${after != null && after < 0 ? 'rounded bg-coral/15 px-1 text-coral-text' : ''}`}>{after ?? '—'}</strong>
              </span>
            </div>
          </div>
          <Field label="Motivo" htmlFor="movement-reason" optional hint={reasonHints[type]}>
            <Input id="movement-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={register.isPending}>
              {register.isPending ? 'Salvando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
