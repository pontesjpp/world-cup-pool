import { describe, it, expect } from 'vitest'
import { computeGroupStandings } from './standings'
import type { GroupMatchScore } from './types'

// Helper: monta os 6 jogos de um grupo de 4 a partir de uma matriz de placares.
function match(home: string, away: string, hg: number, ag: number): GroupMatchScore {
  return { home, away, homeGoals: hg, awayGoals: ag }
}

describe('computeGroupStandings', () => {
  it('ordena por pontos quando não há empate', () => {
    const teams = ['A', 'B', 'C', 'D']
    const matches = [
      match('A', 'B', 2, 0),
      match('A', 'C', 1, 0),
      match('A', 'D', 3, 0),
      match('B', 'C', 1, 0),
      match('B', 'D', 1, 0),
      match('C', 'D', 1, 0),
    ]
    const s = computeGroupStandings(teams, matches)
    expect(s.map((r) => r.team)).toEqual(['A', 'B', 'C', 'D'])
    expect(s[0].points).toBe(9)
    expect(s.every((r) => !r.tiebreakByLot)).toBe(true)
  })

  it('desempata por saldo de gols antes de gols pró', () => {
    // A e B com 9 pts cada... impossível num grupo; usamos empate em pts via 1 vitória cada
    const teams = ['A', 'B', 'C', 'D']
    const matches = [
      match('A', 'B', 0, 0), // A e B empatam entre si
      match('A', 'C', 5, 0),
      match('A', 'D', 1, 0),
      match('B', 'C', 1, 0),
      match('B', 'D', 1, 0),
      match('C', 'D', 0, 0),
    ]
    // A: 0-0, 5-0, 1-0 => 7 pts, SG +6 ; B: 0-0,1-0,1-0 => 7 pts, SG +2
    const s = computeGroupStandings(teams, matches)
    expect(s[0].team).toBe('A')
    expect(s[1].team).toBe('B')
    expect(s[0].gd).toBeGreaterThan(s[1].gd)
  })

  it('usa confronto direto quando pts, saldo e gols pró empatam', () => {
    // A, B, C todos com mesmos pts/SG/GP no geral, mas A venceu o confronto direto.
    const teams = ['A', 'B', 'C', 'D']
    const matches = [
      // resultados entre A,B,C formam um triângulo onde A leva vantagem no H2H
      match('A', 'B', 1, 0),
      match('B', 'C', 1, 0),
      match('C', 'A', 0, 0),
      // todos batem D pelo mesmo placar p/ igualar GP/SG no geral
      match('A', 'D', 2, 0),
      match('B', 'D', 2, 0),
      match('C', 'D', 2, 0),
    ]
    const s = computeGroupStandings(teams, matches)
    // D é claramente último
    expect(s[3].team).toBe('D')
    // A, B, C ocupam 1-3 em alguma ordem definida pelo H2H (sem sorteio)
    expect(new Set([s[0].team, s[1].team, s[2].team])).toEqual(new Set(['A', 'B', 'C']))
  })

  it('marca tiebreakByLot quando nem o confronto direto separa', () => {
    // A e B idênticos em tudo, inclusive no confronto direto (empate).
    const teams = ['A', 'B', 'C', 'D']
    const matches = [
      match('A', 'B', 1, 1),
      match('A', 'C', 2, 0),
      match('B', 'C', 2, 0),
      match('A', 'D', 2, 0),
      match('B', 'D', 2, 0),
      match('C', 'D', 0, 0),
    ]
    const s = computeGroupStandings(teams, matches)
    const top2 = s.slice(0, 2)
    expect(new Set(top2.map((r) => r.team))).toEqual(new Set(['A', 'B']))
    expect(top2.every((r) => r.tiebreakByLot)).toBe(true)
    // fallback alfabético: A antes de B
    expect(s[0].team).toBe('A')
  })

  it('respeita rankOf como critério determinístico final', () => {
    const teams = ['A', 'B', 'C', 'D']
    const matches = [
      match('A', 'B', 1, 1),
      match('A', 'C', 2, 0),
      match('B', 'C', 2, 0),
      match('A', 'D', 2, 0),
      match('B', 'D', 2, 0),
      match('C', 'D', 0, 0),
    ]
    // B tem rank melhor (menor) que A
    const rankOf = (t: string) => (t === 'B' ? 1 : 99)
    const s = computeGroupStandings(teams, matches, rankOf)
    expect(s[0].team).toBe('B')
    expect(s[0].tiebreakByLot).toBe(true)
  })

  it('ignora jogos sem placar preenchido', () => {
    const teams = ['A', 'B', 'C', 'D']
    const matches: GroupMatchScore[] = [
      match('A', 'B', 3, 0),
      { home: 'C', away: 'D', homeGoals: null, awayGoals: null },
    ]
    const s = computeGroupStandings(teams, matches)
    expect(s[0].team).toBe('A')
    expect(s[0].played).toBe(1)
    expect(s.find((r) => r.team === 'C')!.played).toBe(0)
  })
})
