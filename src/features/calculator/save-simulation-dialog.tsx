import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/common/field'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { useSaveSimulation } from './api'
import type { CalculatorInputs, ProfitResult } from './engine'

interface SaveSimulationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inputs: CalculatorInputs
  result: ProfitResult
  /** Id da simulação aberta para edição (salvar atualiza em vez de criar). */
  existingId?: string | null
  initialName?: string | null
  initialProductId?: string | null
  onSaved: (id: string) => void
  /** Campo extra (ex.: escolher produto do estoque). */
  productPicker?: (value: string | null, onChange: (id: string | null) => void) => ReactNode
}

export function SaveSimulationDialog({ open, onOpenChange, inputs, result, existingId, initialName, initialProductId, onSaved, productPicker }: SaveSimulationDialogProps) {
  const save = useSaveSimulation()
  const [name, setName] = useState(initialName || `Simulação de ${formatDate(new Date())}`)
  const [productId, setProductId] = useState<string | null>(initialProductId ?? null)
  const [error, setError] = useState<string | null>(null)

  async function submit(asNew: boolean) {
    setError(null)
    if (!name.trim()) return setError('Dê um nome para a simulação.')
    try {
      const id = await save.mutateAsync({ id: asNew ? undefined : (existingId ?? undefined), name: name.trim(), productId, inputs, result })
      toast.success('Simulação salva.')
      onSaved(id)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar simulação</DialogTitle>
          <DialogDescription>Fica guardada em “Minhas simulações” para consultar depois.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            submit(false)
          }}
        >
          {error && <Alert variant="danger">{error}</Alert>}
          <Field label="Nome" htmlFor="simulation-name">
            <Input id="simulation-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          {productPicker?.(productId, setProductId)}
          <DialogFooter>
            {existingId && (
              <Button type="button" variant="outline" disabled={save.isPending} onClick={() => submit(true)}>
                Salvar como nova
              </Button>
            )}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : existingId ? 'Salvar alterações' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
