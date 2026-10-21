import { describe, expect, it } from 'vitest'
import { slugify } from './utils'

describe('slugify', () => {
  it('gera endereço amigável', () => {
    expect(slugify('Programa Decola: o que é?')).toBe('programa-decola-o-que-e')
    expect(slugify('  Pós-venda & devoluções  ')).toBe('pos-venda-devolucoes')
    expect(slugify('Ação')).toBe('acao')
  })
})
