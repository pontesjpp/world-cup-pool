import { describe, it, expect } from 'vitest'
import { seedR32, computeBracketSlots } from './bracket'
import { THIRD_PLACE_MATRIX } from './thirdPlaceMatrix'
import type { BracketSlot, StandingRow } from './types'

// Espelho do bracket_template oficial (supabase/seed.sql). Mantém os dois em sync.
const slot = (
  slot_key: string,
  round: BracketSlot['round'],
  match_no: number,
  o: Partial<BracketSlot>,
): BracketSlot => ({
  slot_key,
  round,
  match_no,
  feeds_from_home: o.feeds_from_home ?? null,
  feeds_from_away: o.feeds_from_away ?? null,
  source_home: o.source_home ?? null,
  source_away: o.source_away ?? null,
  points_per_slot: o.points_per_slot ?? 0,
})

const TEMPLATE: BracketSlot[] = [
  slot('R32-1', 'R32', 73, { source_home: '2A', source_away: '2B', points_per_slot: 3 }),
  slot('R32-2', 'R32', 74, { source_home: '1E', source_away: '3RD', points_per_slot: 3 }),
  slot('R32-3', 'R32', 75, { source_home: '1F', source_away: '2C', points_per_slot: 3 }),
  slot('R32-4', 'R32', 76, { source_home: '1C', source_away: '2F', points_per_slot: 3 }),
  slot('R32-5', 'R32', 77, { source_home: '1I', source_away: '3RD', points_per_slot: 3 }),
  slot('R32-6', 'R32', 78, { source_home: '2E', source_away: '2I', points_per_slot: 3 }),
  slot('R32-7', 'R32', 79, { source_home: '1A', source_away: '3RD', points_per_slot: 3 }),
  slot('R32-8', 'R32', 80, { source_home: '1L', source_away: '3RD', points_per_slot: 3 }),
  slot('R32-9', 'R32', 81, { source_home: '1D', source_away: '3RD', points_per_slot: 3 }),
  slot('R32-10', 'R32', 82, { source_home: '1G', source_away: '3RD', points_per_slot: 3 }),
  slot('R32-11', 'R32', 83, { source_home: '2K', source_away: '2L', points_per_slot: 3 }),
  slot('R32-12', 'R32', 84, { source_home: '1H', source_away: '2J', points_per_slot: 3 }),
  slot('R32-13', 'R32', 85, { source_home: '1B', source_away: '3RD', points_per_slot: 3 }),
  slot('R32-14', 'R32', 86, { source_home: '1J', source_away: '2H', points_per_slot: 3 }),
  slot('R32-15', 'R32', 87, { source_home: '1K', source_away: '3RD', points_per_slot: 3 }),
  slot('R32-16', 'R32', 88, { source_home: '2D', source_away: '2G', points_per_slot: 3 }),
  slot('R16-1', 'R16', 89, { feeds_from_home: 'R32-2', feeds_from_away: 'R32-5', points_per_slot: 6 }),
  slot('R16-2', 'R16', 90, { feeds_from_home: 'R32-1', feeds_from_away: 'R32-3', points_per_slot: 6 }),
  slot('R16-3', 'R16', 91, { feeds_from_home: 'R32-4', feeds_from_away: 'R32-6', points_per_slot: 6 }),
  slot('R16-4', 'R16', 92, { feeds_from_home: 'R32-7', feeds_from_away: 'R32-8', points_per_slot: 6 }),
  slot('R16-5', 'R16', 93, { feeds_from_home: 'R32-11', feeds_from_away: 'R32-12', points_per_slot: 6 }),
  slot('R16-6', 'R16', 94, { feeds_from_home: 'R32-9', feeds_from_away: 'R32-10', points_per_slot: 6 }),
  slot('R16-7', 'R16', 95, { feeds_from_home: 'R32-14', feeds_from_away: 'R32-16', points_per_slot: 6 }),
  slot('R16-8', 'R16', 96, { feeds_from_home: 'R32-13', feeds_from_away: 'R32-15', points_per_slot: 6 }),
  slot('QF-1', 'QF', 97, { feeds_from_home: 'R16-1', feeds_from_away: 'R16-2', points_per_slot: 9 }),
  slot('QF-2', 'QF', 98, { feeds_from_home: 'R16-5', feeds_from_away: 'R16-6', points_per_slot: 9 }),
  slot('QF-3', 'QF', 99, { feeds_from_home: 'R16-3', feeds_from_away: 'R16-4', points_per_slot: 9 }),
  slot('QF-4', 'QF', 100, { feeds_from_home: 'R16-7', feeds_from_away: 'R16-8', points_per_slot: 9 }),
  slot('SF-1', 'SF', 101, { feeds_from_home: 'QF-1', feeds_from_away: 'QF-2', points_per_slot: 12 }),
  slot('SF-2', 'SF', 102, { feeds_from_home: 'QF-3', feeds_from_away: 'QF-4', points_per_slot: 12 }),
  slot('THIRD', 'THIRD', 103, { feeds_from_home: 'SF-1', feeds_from_away: 'SF-2', points_per_slot: 13 }),
  slot('FINAL', 'FINAL', 104, { feeds_from_home: 'SF-1', feeds_from_away: 'SF-2', points_per_slot: 13 }),
]

const LETTERS = 'ABCDEFGHIJKL'.split('')

// Classificação sintética: time = "<pos><grupo>" (ex: "1A"). O 3º de cada grupo
// recebe pontos decrescentes A>B>...>L → os 8 melhores 3ºs são A..H (combo ABCDEFGH).
function buildStandings(): Record<string, StandingRow[]> {
  const out: Record<string, StandingRow[]> = {}
  LETTERS.forEach((g, i) => {
    const row = (pos: number, points: number): StandingRow => ({
      team: `${pos}${g}`,
      position: pos,
      points,
      gd: 0,
      gf: 0,
      ga: 0,
      played: 3,
      won: 0,
      drawn: 0,
      lost: 0,
      tiebreakByLot: false,
    })
    out[g] = [row(1, 9), row(2, 6), row(3, 100 - i), row(4, 0)]
  })
  return out
}

const groupOf = (team: string) => team[1] // "3C" -> "C"

describe('bracket oficial 2026 (template + matriz)', () => {
  const standings = buildStandings()
  const { r32, comboKey, matrixHit } = seedR32(standings, TEMPLATE, THIRD_PLACE_MATRIX)

  it('os 8 melhores 3ºs formam o combo esperado e a matriz é encontrada', () => {
    expect(comboKey).toBe('ABCDEFGH')
    expect(matrixHit).toBe(true)
  })

  it('todos os 16 confrontos do R32 têm os dois lados preenchidos', () => {
    for (const s of TEMPLATE.filter((x) => x.round === 'R32')) {
      expect(r32[s.slot_key].home, s.slot_key).toBeTruthy()
      expect(r32[s.slot_key].away, s.slot_key).toBeTruthy()
    }
  })

  it('o R32 tem exatamente 32 seleções distintas (12+12+8)', () => {
    const teams = new Set<string>()
    for (const s of TEMPLATE.filter((x) => x.round === 'R32')) {
      teams.add(r32[s.slot_key].home!)
      teams.add(r32[s.slot_key].away!)
    }
    expect(teams.size).toBe(32)
  })

  it('nenhum confronto do R32 coloca dois times do mesmo grupo', () => {
    const erros: string[] = []
    for (const s of TEMPLATE.filter((x) => x.round === 'R32')) {
      const { home, away } = r32[s.slot_key]
      if (home && away && groupOf(home) === groupOf(away)) erros.push(`${s.slot_key}: ${home} vs ${away}`)
    }
    expect(erros).toEqual([])
  })

  it('os 3ºs caem nos slots oficiais conforme a matriz (combo ABCDEFGH)', () => {
    // coluna [A,B,D,E,G,I,K,L] -> thirds "HGBCAFDE"
    expect(r32['R32-7'].away).toBe('3H') // vencedor A
    expect(r32['R32-13'].away).toBe('3G') // vencedor B
    expect(r32['R32-9'].away).toBe('3B') // vencedor D
    expect(r32['R32-2'].away).toBe('3C') // vencedor E
    expect(r32['R32-10'].away).toBe('3A') // vencedor G
    expect(r32['R32-5'].away).toBe('3F') // vencedor I
    expect(r32['R32-15'].away).toBe('3D') // vencedor K
    expect(r32['R32-8'].away).toBe('3E') // vencedor L
  })

  it('a propagação leva um campeão único até a Final', () => {
    // pick: sempre o lado "home" avança
    const picks: Record<string, string> = {}
    const order = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'] as const
    for (const round of order) {
      for (const s of TEMPLATE.filter((x) => x.round === round)) {
        const slots = computeBracketSlots(TEMPLATE, r32, picks)
        const p = slots[s.slot_key]
        if (p.home) picks[s.slot_key] = p.home
      }
    }
    const finalSlots = computeBracketSlots(TEMPLATE, r32, picks)
    expect(finalSlots['FINAL'].home).toBeTruthy()
    expect(finalSlots['FINAL'].away).toBeTruthy()
    expect(picks['FINAL']).toBeTruthy()
    // 3º lugar recebe os perdedores das semis (lado away, já que home avançou)
    expect(finalSlots['THIRD'].home).toBeTruthy()
    expect(finalSlots['THIRD'].away).toBeTruthy()
  })
})
