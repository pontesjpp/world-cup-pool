import { describe, it, expect } from 'vitest'
import {
  rankFinalizado,
  rankAoVivo,
  DEFAULT_SCORE_CFG,
  type GaleraRow,
} from './palpitesGalera'

function row(over: Partial<GaleraRow> & { user_id: string; nome: string }): GaleraRow {
  return {
    partida_id: 'p1',
    avatar_url: null,
    palpite_casa: 0,
    palpite_fora: 0,
    pontos_obtidos: 0,
    categoria: null,
    solitario: false,
    ...over,
  }
}

describe('rankFinalizado', () => {
  it('ordena por pontos persistidos (desc) e marca o usuário atual', () => {
    const rows = [
      row({ user_id: 'a', nome: 'Ana', pontos_obtidos: 3 }),
      row({ user_id: 'b', nome: 'Beto', pontos_obtidos: 5 }),
      row({ user_id: 'c', nome: 'Cris', pontos_obtidos: 0 }),
    ]
    const r = rankFinalizado(rows, 'a')
    expect(r.map((x) => x.user_id)).toEqual(['b', 'a', 'c'])
    expect(r.map((x) => x.pontos)).toEqual([5, 3, 0])
    expect(r.find((x) => x.user_id === 'a')!.isMe).toBe(true)
  })

  it('desempata alfabeticamente', () => {
    const rows = [
      row({ user_id: 'z', nome: 'Zeca', pontos_obtidos: 4 }),
      row({ user_id: 'a', nome: 'Aline', pontos_obtidos: 4 }),
    ]
    expect(rankFinalizado(rows, null).map((x) => x.nome)).toEqual(['Aline', 'Zeca'])
  })
})

describe('rankAoVivo', () => {
  it('recalcula pontos provisórios contra o placar parcial', () => {
    // Placar ao vivo 2–1: Ana cravou (D=5), Beto acertou o vencedor (A=3), Cris errou (0).
    const rows = [
      row({ user_id: 'a', nome: 'Ana', palpite_casa: 2, palpite_fora: 1 }),
      row({ user_id: 'b', nome: 'Beto', palpite_casa: 3, palpite_fora: 2 }),
      row({ user_id: 'c', nome: 'Cris', palpite_casa: 0, palpite_fora: 2 }),
    ]
    const r = rankAoVivo(rows, 2, 1, DEFAULT_SCORE_CFG, 'b')
    expect(r[0].user_id).toBe('a')
    // Ana foi a única a cravar o placar exato → ganha o bônus solitário (+2).
    expect(r[0].pontos).toBe(DEFAULT_SCORE_CFG.pts_d + DEFAULT_SCORE_CFG.pts_solitario)
    expect(r[0].solitario).toBe(true)
    expect(r.map((x) => x.pontos)).toEqual([7, 3, 0])
  })

  it('não dá bônus solitário se mais de um cravou o placar exato', () => {
    const rows = [
      row({ user_id: 'a', nome: 'Ana', palpite_casa: 1, palpite_fora: 1 }),
      row({ user_id: 'b', nome: 'Beto', palpite_casa: 1, palpite_fora: 1 }),
    ]
    const r = rankAoVivo(rows, 1, 1, DEFAULT_SCORE_CFG, null)
    expect(r.every((x) => x.solitario === false)).toBe(true)
    expect(r.every((x) => x.pontos === DEFAULT_SCORE_CFG.pts_f)).toBe(true)
  })
})
