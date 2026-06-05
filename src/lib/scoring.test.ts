import { describe, it, expect } from 'vitest'
import { scoreMatch, type ScoreCfg } from './scoring'

const cfg: ScoreCfg = {
  pts_a: 3,
  pts_b: 4,
  pts_c: 4,
  pts_d: 5,
  pts_e: 3,
  pts_f: 5,
  pts_p: 1,
}

describe('scoreMatch', () => {
  it('D — placar exato com vencedor', () => {
    expect(scoreMatch(3, 1, 3, 1, cfg)).toEqual({ categoria: 'D', pts: 5 })
  })
  it('F — empate exato', () => {
    expect(scoreMatch(1, 1, 1, 1, cfg)).toEqual({ categoria: 'F', pts: 5 })
  })
  it('E — empate certo, placar errado', () => {
    expect(scoreMatch(0, 0, 2, 2, cfg)).toEqual({ categoria: 'E', pts: 3 })
  })
  it('A — só o vencedor', () => {
    expect(scoreMatch(2, 0, 3, 1, cfg)).toEqual({ categoria: 'A', pts: 3 })
  })
  it('B — vencedor + gols do vencedor (gols do perdedor errados)', () => {
    // palpite 3x0, real 3x1: vencedor=casa, gols do vencedor 3=3 ok, perdedor 0≠1
    expect(scoreMatch(3, 0, 3, 1, cfg)).toEqual({ categoria: 'B', pts: 4 })
  })
  it('C — vencedor + gols do perdedor (gols do vencedor errados)', () => {
    // palpite 2x1, real 3x1: vencedor=casa, gols vencedor 2≠3, perdedor 1=1
    expect(scoreMatch(2, 1, 3, 1, cfg)).toEqual({ categoria: 'C', pts: 4 })
  })
  it('P — errou o resultado mas cravou os gols de um time', () => {
    // exemplo do regulamento: palpite 2x0, real 0x0 → cravou gols do fora (0)
    expect(scoreMatch(2, 0, 0, 0, cfg)).toEqual({ categoria: 'P', pts: 1 })
  })
  it('P — palpitou empate mas deu vitória, cravou gols de um time', () => {
    // palpite 1x1, real 1x0 → cravou casa (1)
    expect(scoreMatch(1, 1, 1, 0, cfg)).toEqual({ categoria: 'P', pts: 1 })
  })
  it('0 — errou tudo', () => {
    expect(scoreMatch(2, 0, 0, 3, cfg)).toEqual({ categoria: null, pts: 0 })
  })
  it('hierarquia: D não vira P mesmo cravando ambos', () => {
    expect(scoreMatch(2, 1, 2, 1, cfg).categoria).toBe('D')
  })
  it('vencedor invertido sem cravar gols não pontua', () => {
    // palpite casa vence 2x1, real fora vence 1x2 → não cravou nenhum lado
    expect(scoreMatch(2, 1, 1, 2, cfg)).toEqual({ categoria: null, pts: 0 })
  })
  it('vencedor invertido mas cravou um lado → P', () => {
    // palpite 2x1, real 0x1 → fora 1=1
    expect(scoreMatch(2, 1, 0, 1, cfg)).toEqual({ categoria: 'P', pts: 1 })
  })
})
