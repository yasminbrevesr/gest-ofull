import { ArrowLeft, CircleCheck, CircleX, Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { useImportProducts, type ImportResult } from './api'
import { csvTemplate, parseProductsCsv, type ParsedImport } from './csv'
import { downloadFile } from './stock-page'

const MAX_FILE_BYTES = 2 * 1024 * 1024

export default function ImportPage() {
  const importer = useImportProducts()
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [results, setResults] = useState<ImportResult[] | null>(null)

  async function chooseFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) return toast.error('O arquivo precisa ter no máximo 2 MB.')
    setResults(null)
    setFileName(file.name)
    const content = await file.text()
    setParsed(parseProductsCsv(content))
  }

  async function runImport() {
    if (!parsed?.rows.length) return
    try {
      const data = await importer.mutateAsync(parsed.rows)
      setResults(data)
      const failed = data.filter((r) => r.status === 'erro').length
      if (failed) toast.warning(`Importação concluída com ${failed} erro(s). Confira abaixo.`)
      else toast.success('Importação concluída!')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  function reset() {
    setParsed(null)
    setResults(null)
    setFileName(null)
  }

  return (
    <>
      <Link to="/estoque" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline">
        <ArrowLeft className="size-4" /> Estoque
      </Link>
      <PageHeader
        title="Importar planilha"
        description="Cadastre ou atualize vários produtos de uma vez com um arquivo CSV (pode ser salvo pelo Excel ou Google Planilhas)."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {!parsed && (
            <Card>
              <CardContent className="pt-5">
                <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/50 px-6 py-12 text-center transition-colors hover:border-primary/60">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-text">
                    <Upload />
                  </span>
                  <span className="font-semibold">Escolha o arquivo CSV</span>
                  <span className="text-sm text-muted-foreground">Até 2 MB e 2.000 linhas.</span>
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => chooseFile(e.target.files?.[0])} />
                </label>
              </CardContent>
            </Card>
          )}

          {parsed && !results && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-primary-text" /> {fileName}
                </CardTitle>
                <CardDescription>
                  {parsed.rows.length} linha(s) prontas para importar
                  {parsed.errors.length > 0 && `, ${parsed.errors.length} com erro (não serão importadas)`}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {parsed.unknownColumns.length > 0 && (
                  <Alert variant="warning">Colunas ignoradas (nome não reconhecido): {parsed.unknownColumns.join(', ')}.</Alert>
                )}
                {parsed.errors.length > 0 && (
                  <Alert variant="danger" title="Linhas com erro">
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {parsed.errors.slice(0, 20).map((e) => (
                        <li key={e.line}>
                          Linha {e.line}
                          {e.sku ? ` (${e.sku})` : ''}: {e.message}
                        </li>
                      ))}
                      {parsed.errors.length > 20 && <li>…e mais {parsed.errors.length - 20}.</li>}
                    </ul>
                  </Alert>
                )}
                {parsed.rows.length > 0 && (
                  <div className="max-h-96 overflow-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Linha</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Nome / variação</TableHead>
                          <TableHead className="text-right">Custo</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead className="text-right">Estoque</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsed.rows.slice(0, 200).map((r) => (
                          <TableRow key={r.line}>
                            <TableCell className="text-muted-foreground">{r.line}</TableCell>
                            <TableCell className="font-medium">{r.sku}</TableCell>
                            <TableCell>
                              {r.name ?? <span className="text-muted-foreground">(mantém)</span>}
                              {r.variant_name && <span className="block text-xs text-muted-foreground">Variação: {r.variant_name}</span>}
                            </TableCell>
                            <TableCell className="tabular text-right">{r.cost == null ? '—' : formatCurrency(r.cost)}</TableCell>
                            <TableCell className="tabular text-right">{r.sale_price == null ? '—' : formatCurrency(r.sale_price)}</TableCell>
                            <TableCell className="tabular text-right">{r.stock ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={reset}>
                    <RotateCcw /> Escolher outro arquivo
                  </Button>
                  <Button onClick={runImport} disabled={!parsed.rows.length || importer.isPending}>
                    {importer.isPending ? 'Importando…' : `Importar ${parsed.rows.length} linha(s)`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {results && <ImportResults results={results} onReset={reset} />}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Como montar a planilha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <Button variant="soft" size="sm" className="w-full" onClick={() => downloadFile(csvTemplate(), 'modelo-estoque.csv')}>
              <Download /> Baixar modelo
            </Button>
            <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
              <li>
                <strong className="text-foreground">sku</strong> é obrigatório. Se já existir, o produto é atualizado; se não, é criado.
              </li>
              <li>
                Produto novo precisa de <strong className="text-foreground">nome</strong>.
              </li>
              <li>
                Variações: preencha <strong className="text-foreground">sku_produto</strong> (SKU do produto principal) e{' '}
                <strong className="text-foreground">variacao</strong> (ex.: Azul / M).
              </li>
              <li>
                <strong className="text-foreground">estoque</strong> é a quantidade contada: a diferença vira um ajuste no histórico.
              </li>
              <li>Célula vazia mantém o valor atual.</li>
              <li>Números podem ter vírgula (12,50). Salve como CSV (separado por ponto e vírgula ou vírgula).</li>
            </ul>
            <p className="text-muted-foreground">Dica: exporte seu estoque, edite no Excel e importe de volta.</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ImportResults({ results, onReset }: { results: ImportResult[]; onReset: () => void }) {
  const created = results.filter((r) => r.status === 'criado').length
  const updated = results.filter((r) => r.status === 'atualizado').length
  const failed = results.filter((r) => r.status === 'erro')
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado da importação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">
            <CircleCheck /> {created} criado(s)
          </Badge>
          <Badge variant="muted">{updated} atualizado(s)</Badge>
          {failed.length > 0 && (
            <Badge variant="danger">
              <CircleX /> {failed.length} com erro
            </Badge>
          )}
        </div>
        {failed.length > 0 && (
          <Alert variant="danger" title="Linhas não importadas">
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {failed.map((r) => (
                <li key={r.line}>
                  Linha {r.line}
                  {r.sku ? ` (${r.sku})` : ''}: {r.message}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onReset}>
            Importar outro arquivo
          </Button>
          <Button asChild>
            <Link to="/estoque">Ver estoque</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
