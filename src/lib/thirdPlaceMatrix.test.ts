import { describe, it, expect } from 'vitest'
import { THIRD_PLACE_RAW, THIRD_FACING_WINNERS } from './thirdPlaceMatrix'

const sorted = (s: string) => s.split('').sort().join('')

describe('THIRD_PLACE_RAW (tabela oficial FIFA 2026)', () => {
  const entries = Object.entries(THIRD_PLACE_RAW)

  it('tem exatamente 495 combinações (C(12,8))', () => {
    expect(entries.length).toBe(495)
  })

  it('todas as chaves de combo são únicas e já ordenadas', () => {
    expect(new Set(Object.keys(THIRD_PLACE_RAW)).size).toBe(495)
    for (const combo of Object.keys(THIRD_PLACE_RAW)) {
      expect(combo).toBe(sorted(combo))
      expect(combo.length).toBe(8)
      expect(/^[A-L]{8}$/.test(combo)).toBe(true)
      expect(new Set(combo).size).toBe(8) // sem letras repetidas
    }
  })

  it('cada atribuição é uma permutação exata dos 3ºs classificados', () => {
    const erros: string[] = []
    for (const [combo, thirds] of entries) {
      if (thirds.length !== 8) erros.push(`${combo}: comprimento ${thirds.length}`)
      else if (sorted(thirds) !== combo) erros.push(`${combo}: thirds=${thirds} (ordenado=${sorted(thirds)})`)
    }
    expect(erros).toEqual([])
  })

  it('nenhum vencedor enfrenta o 3º do próprio grupo', () => {
    const erros: string[] = []
    for (const [combo, thirds] of entries) {
      for (let i = 0; i < 8; i++) {
        if (thirds[i] === THIRD_FACING_WINNERS[i]) {
          erros.push(`${combo}: posição ${i} (vencedor ${THIRD_FACING_WINNERS[i]}) enfrenta 3${thirds[i]}`)
        }
      }
    }
    expect(erros).toEqual([])
  })
})
