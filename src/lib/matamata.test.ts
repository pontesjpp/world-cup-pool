import { describe, it, expect } from 'vitest'
import { standingsFromClassificacao, buildUserSlots, type ClassRow } from './matamata'
import type { BracketSlot } from './types'

function slot(
  slot_key: string,
  round: BracketSlot['round'],
  opts: Partial<BracketSlot> = {},
): BracketSlot {
  return {
    slot_key,
    round,
    match_no: opts.match_no ?? 1,
    feeds_from_home: opts.feeds_from_home ?? null,
    feeds_from_away: opts.feeds_from_away ?? null,
    source_home: opts.source_home ?? null,
    source_away: opts.source_away ?? null,
    points_per_slot: opts.points_per_slot ?? 0,
  }
}

describe('standingsFromClassificacao', () => {
  it('agrupa por letra, ordena por posição e zera as stats', () => {
    const rows: ClassRow[] = [
      { grupo: 'Group A', posicao: 2, time: 'a2' },
      { grupo: 'Group A', posicao: 1, time: 'a1' },
      { grupo: 'B', posicao: 1, time: 'b1' },
    ]
    const s = standingsFromClassificacao(rows)
    expect(Object.keys(s).sort()).toEqual(['A', 'B'])
    expect(s.A.map((r) => r.team)).toEqual(['a1', 'a2'])
    expect(s.A[0].position).toBe(1)
    expect(s.A[0].points).toBe(0)
  })
})

describe('buildUserSlots', () => {
  // 2 slots R32 → 1 R16. Semeadura usa 1A/2B/1B + um 3º (fallback).
  const template: BracketSlot[] = [
    slot('R32-1', 'R32', { source_home: '1A', source_away: '2B', match_no: 1 }),
    slot('R32-2', 'R32', { source_home: '1B', source_away: '3RD', match_no: 2 }),
    slot('R16-1', 'R16', { feeds_from_home: 'R32-1', feeds_from_away: 'R32-2', match_no: 3 }),
  ]
  const classificacao: ClassRow[] = [
    { grupo: 'A', posicao: 1, time: 'a1' },
    { grupo: 'A', posicao: 2, time: 'a2' },
    { grupo: 'A', posicao: 3, time: 'a3' },
    { grupo: 'B', posicao: 1, time: 'b1' },
    { grupo: 'B', posicao: 2, time: 'b2' },
    { grupo: 'B', posicao: 3, time: 'b3' },
  ]

  it('semeia o R32 a partir da classificação do usuário', () => {
    const slots = buildUserSlots(template, {}, classificacao, {})
    expect(slots['R32-1']).toEqual({ home: 'a1', away: 'b2' })
    expect(slots['R32-2'].home).toBe('b1')
    // away do R32-2 é um 3º (fallback determinístico) — algum dos a3/b3
    expect(['a3', 'b3']).toContain(slots['R32-2'].away)
  })

  it('propaga o vencedor escolhido para o R16', () => {
    const picks = { 'R32-1': 'a1', 'R32-2': 'b1' }
    const slots = buildUserSlots(template, {}, classificacao, picks)
    expect(slots['R16-1']).toEqual({ home: 'a1', away: 'b1' })
  })
})
