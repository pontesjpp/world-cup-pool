import { describe, it, expect } from 'vitest'
import {
  pickBestThirds,
  rankAllThirds,
  seedR32,
  computeBracketSlots,
  detectStale,
  prunePicks,
  deriveFinais,
  grupoLetra,
  buildActualSlots,
} from './bracket'
import type { BracketSlot, StandingRow } from './types'

function row(team: string, position: number, points: number, gd: number, gf: number): StandingRow {
  return {
    team,
    position,
    points,
    gd,
    gf,
    ga: gf - gd,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    tiebreakByLot: false,
  }
}

function slot(
  slot_key: string,
  round: BracketSlot['round'],
  opts: Partial<BracketSlot> = {},
): BracketSlot {
  return {
    slot_key,
    round,
    match_no: 1,
    feeds_from_home: opts.feeds_from_home ?? null,
    feeds_from_away: opts.feeds_from_away ?? null,
    source_home: opts.source_home ?? null,
    source_away: opts.source_away ?? null,
    points_per_slot: opts.points_per_slot ?? 0,
  }
}

describe('buildActualSlots', () => {
  const part = (
    slot_key: string | null,
    time_casa: string,
    time_fora: string,
    external_id: number,
    grupo: string | null = null,
  ) => ({ slot_key, time_casa, time_fora, external_id, grupo })

  it('monta os confrontos por slot ignorando jogos de grupo', () => {
    const slots = buildActualSlots([
      part('R32-1', 'South Africa', 'Canada', -73),
      part(null, 'Brazil', 'Serbia', 5, 'Group G'),
    ])
    expect(slots['R32-1']).toEqual({ home: 'South Africa', away: 'Canada' })
    expect(Object.keys(slots)).toEqual(['R32-1'])
  })

  it('ignora slots com time placeholder ("undefined"/"a definir")', () => {
    const slots = buildActualSlots([
      part('R32-7', 'Mexico', 'undefined', -79),
      part('R32-8', 'undefined', 'undefined', -80),
      part('R32-9', 'United States', 'A definir', -81),
    ])
    expect(slots).toEqual({})
  })

  it('em slot_key duplicado, prefere a linha manual (external_id < 0)', () => {
    // Bug real: jogo da API (Brazil x Japan) foi atribuído ao slot errado (R32-6),
    // colidindo com a linha manual correta (Ivory Coast x Norway).
    const slots = buildActualSlots([
      part('R32-6', 'Brazil', 'Japan', 537423),
      part('R32-6', 'Ivory Coast', 'Norway', -78),
    ])
    expect(slots['R32-6']).toEqual({ home: 'Ivory Coast', away: 'Norway' })
  })

  it('usa a linha da API quando não há linha manual para o slot', () => {
    const slots = buildActualSlots([part('R16-1', 'Brazil', 'France', 99001)])
    expect(slots['R16-1']).toEqual({ home: 'Brazil', away: 'France' })
  })
})

describe('grupoLetra', () => {
  it('extrai a letra de variações', () => {
    expect(grupoLetra('Group A')).toBe('A')
    expect(grupoLetra('Grupo L')).toBe('L')
    expect(grupoLetra('C')).toBe('C')
  })
})

describe('pickBestThirds', () => {
  it('seleciona os melhores 3ºs por pts/SG/GP e gera comboKey ordenado', () => {
    const standings = {
      A: [row('a1', 1, 9, 5, 6), row('a2', 2, 6, 2, 4), row('a3', 3, 4, 1, 3), row('a4', 4, 0, -8, 0)],
      B: [row('b1', 1, 9, 5, 6), row('b2', 2, 6, 2, 4), row('b3', 3, 3, 0, 2), row('b4', 4, 0, -7, 1)],
      C: [row('c1', 1, 9, 5, 6), row('c2', 2, 6, 2, 4), row('c3', 3, 4, 2, 5), row('c4', 4, 0, -9, 0)],
    }
    const { qualifiers, comboKey } = pickBestThirds(standings)
    // 3 grupos => 3 terceiros, todos qualificam (top 8)
    expect(qualifiers).toHaveLength(3)
    expect(comboKey).toBe('ABC')
    // c3 (4 pts, SG+2) > a3 (4 pts, SG+1) > b3 (3 pts)
    expect(qualifiers.map((q) => q.row.team)).toEqual(['c3', 'a3', 'b3'])
  })
})

describe('rankAllThirds', () => {
  it('ranqueia todos os 3ºs e marca a linha de corte', () => {
    const standings = {
      A: [row('a1', 1, 9, 5, 6), row('a2', 2, 6, 2, 4), row('a3', 3, 4, 1, 3), row('a4', 4, 0, -8, 0)],
      B: [row('b1', 1, 9, 5, 6), row('b2', 2, 6, 2, 4), row('b3', 3, 3, 0, 2), row('b4', 4, 0, -7, 1)],
      C: [row('c1', 1, 9, 5, 6), row('c2', 2, 6, 2, 4), row('c3', 3, 4, 2, 5), row('c4', 4, 0, -9, 0)],
    }
    const ranked = rankAllThirds(standings, 2)
    // ordenação: c3 (SG+2) > a3 (SG+1) > b3 (3 pts)
    expect(ranked.map((r) => r.row.team)).toEqual(['c3', 'a3', 'b3'])
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3])
    // só os 2 melhores qualificam (advanceCount = 2)
    expect(ranked.map((r) => r.qualifies)).toEqual([true, true, false])
    // a letra do grupo acompanha cada 3º
    expect(ranked.map((r) => r.group)).toEqual(['C', 'A', 'B'])
  })
})

describe('seedR32', () => {
  const template = [
    slot('R32-1', 'R32', { source_home: '1A', source_away: '2B', points_per_slot: 3 }),
    slot('R32-2', 'R32', { source_home: '1B', source_away: '3RD', points_per_slot: 3 }),
  ]
  const standings = {
    A: [row('a1', 1, 9, 5, 6), row('a2', 2, 6, 2, 4), row('a3', 3, 4, 1, 3), row('a4', 4, 0, -8, 0)],
    B: [row('b1', 1, 9, 5, 6), row('b2', 2, 6, 2, 4), row('b3', 3, 5, 3, 7), row('b4', 4, 0, -7, 1)],
  }

  it('resolve 1X/2X direto', () => {
    const { r32 } = seedR32(standings, template, {})
    expect(r32['R32-1'].home).toBe('a1')
    expect(r32['R32-1'].away).toBe('b2')
  })

  it('usa fallback quando o combo não está na matriz', () => {
    const { r32, matrixHit } = seedR32(standings, template, {})
    expect(matrixHit).toBe(false)
    // único slot de 3º recebe o melhor 3º (b3, 5 pts)
    expect(r32['R32-2'].away).toBe('b3')
  })

  it('usa a matriz oficial quando o combo existe', () => {
    const matrix = { AB: { 'R32-2.away': '3A' } }
    const { r32, matrixHit } = seedR32(standings, template, matrix)
    expect(matrixHit).toBe(true)
    expect(r32['R32-2'].away).toBe('a3')
  })
})

describe('computeBracketSlots + finais + stale', () => {
  // 8 R32 → 4 R16 → 2 SF → THIRD/FINAL
  const template: BracketSlot[] = [
    ...Array.from({ length: 8 }, (_, i) => slot(`R32-${i + 1}`, 'R32', { points_per_slot: 3 })),
    slot('R16-1', 'R16', { feeds_from_home: 'R32-1', feeds_from_away: 'R32-2', points_per_slot: 6 }),
    slot('R16-2', 'R16', { feeds_from_home: 'R32-3', feeds_from_away: 'R32-4', points_per_slot: 6 }),
    slot('R16-3', 'R16', { feeds_from_home: 'R32-5', feeds_from_away: 'R32-6', points_per_slot: 6 }),
    slot('R16-4', 'R16', { feeds_from_home: 'R32-7', feeds_from_away: 'R32-8', points_per_slot: 6 }),
    slot('SF-1', 'SF', { feeds_from_home: 'R16-1', feeds_from_away: 'R16-2', points_per_slot: 12 }),
    slot('SF-2', 'SF', { feeds_from_home: 'R16-3', feeds_from_away: 'R16-4', points_per_slot: 12 }),
    slot('THIRD', 'THIRD', { feeds_from_home: 'SF-1', feeds_from_away: 'SF-2', points_per_slot: 13 }),
    slot('FINAL', 'FINAL', { feeds_from_home: 'SF-1', feeds_from_away: 'SF-2', points_per_slot: 13 }),
  ]
  const r32 = Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [
      `R32-${i + 1}`,
      { home: `T${2 * i + 1}`, away: `T${2 * i + 2}` },
    ]),
  )
  const picks: Record<string, string> = {
    'R32-1': 'T1', 'R32-2': 'T3', 'R32-3': 'T5', 'R32-4': 'T7',
    'R32-5': 'T9', 'R32-6': 'T11', 'R32-7': 'T13', 'R32-8': 'T15',
    'R16-1': 'T1', 'R16-2': 'T5', 'R16-3': 'T9', 'R16-4': 'T13',
    'SF-1': 'T1', 'SF-2': 'T9',
    FINAL: 'T1', THIRD: 'T5',
  }

  it('propaga vencedores pelas rodadas', () => {
    const slots = computeBracketSlots(template, r32, picks)
    expect(slots['R16-1']).toEqual({ home: 'T1', away: 'T3' })
    expect(slots['SF-1']).toEqual({ home: 'T1', away: 'T5' })
    expect(slots['FINAL']).toEqual({ home: 'T1', away: 'T9' })
  })

  it('THIRD recebe os PERDEDORES das semifinais', () => {
    const slots = computeBracketSlots(template, r32, picks)
    expect(slots['THIRD']).toEqual({ home: 'T5', away: 'T13' })
  })

  it('deriva campeão/vice/3º', () => {
    const slots = computeBracketSlots(template, r32, picks)
    const f = deriveFinais(template, slots, picks)
    expect(f).toEqual({ campeao: 'T1', vice: 'T9', terceiro: 'T5' })
  })

  it('detecta e poda picks stale em cascata após trocar um vencedor de R32', () => {
    const changed = { ...picks, 'R32-1': 'T2' } // antes era T1
    const slots = computeBracketSlots(template, r32, changed)
    const stale = detectStale(slots, changed)
    // R16-1 agora é T2 vs T3; pick T1 ficou inválido
    expect(stale.has('R16-1')).toBe(true)

    const pruned = prunePicks(template, r32, changed)
    expect(pruned['R32-1']).toBe('T2')
    // toda a cadeia que dependia de T1 foi removida
    expect(pruned['R16-1']).toBeUndefined()
    expect(pruned['SF-1']).toBeUndefined()
    expect(pruned['FINAL']).toBeUndefined()
    // ramo independente intacto
    expect(pruned['R16-3']).toBe('T9')
    expect(pruned['SF-2']).toBe('T9')
  })
})
