import { describe, it, expect } from 'vitest'
import { computeMatchStats, type HistRow } from './matchStats'

// 10 palpites: 5 vitória casa, 2 empate, 3 vitória fora.
const hist: HistRow[] = [
  { palpite_casa: 2, palpite_fora: 1, qtd: 4 }, // casa
  { palpite_casa: 3, palpite_fora: 0, qtd: 1 }, // casa
  { palpite_casa: 1, palpite_fora: 1, qtd: 2 }, // empate
  { palpite_casa: 0, palpite_fora: 1, qtd: 2 }, // fora
  { palpite_casa: 1, palpite_fora: 2, qtd: 1 }, // fora
]

describe('computeMatchStats', () => {
  it('soma o total de palpites', () => {
    expect(computeMatchStats(hist).total).toBe(10)
  })

  it('calcula % por desfecho', () => {
    const s = computeMatchStats(hist)
    expect(s.pctCasa).toBe(50)
    expect(s.pctEmpate).toBe(20)
    expect(s.pctFora).toBe(30)
  })

  it('aponta o placar mais cravado', () => {
    const s = computeMatchStats(hist)
    expect(s.placarMaisCravado).toEqual({ casa: 2, fora: 1, qtd: 4, pct: 40 })
    // histograma ordenado por qtd desc
    expect(s.histograma[0]).toMatchObject({ casa: 2, fora: 1 })
  })

  it('calcula média de gols', () => {
    const s = computeMatchStats(hist)
    // casa: (2*4+3*1+1*2+0*2+1*1)/10 = 14/10
    expect(s.mediaCasa).toBe(1.4)
    // fora: (1*4+0*1+1*2+1*2+2*1)/10 = 10/10
    expect(s.mediaFora).toBe(1)
  })

  it('conta cravadas exatas quando há resultado', () => {
    const s = computeMatchStats(hist, { casa: 2, fora: 1 })
    expect(s.exatos).toBe(4)
    expect(s.histograma.find((h) => h.casa === 2 && h.fora === 1)?.acertou).toBe(true)
  })

  it('exatos é null sem resultado e 0 se ninguém cravou', () => {
    expect(computeMatchStats(hist).exatos).toBeNull()
    expect(computeMatchStats(hist, { casa: 5, fora: 5 }).exatos).toBe(0)
  })

  it('Você vs a galera: seguiu a maioria', () => {
    const s = computeMatchStats(hist, { casa: null, fora: null }, { palpite_casa: 2, palpite_fora: 1 })
    expect(s.vocePosicao).toMatchObject({
      desfecho: 'casa',
      seguiuMaioria: true,
      pctMesmoPlacar: 40,
      cravouSozinho: false,
    })
  })

  it('Você vs a galera: contra a maré e sozinho', () => {
    const s = computeMatchStats(hist, { casa: null, fora: null }, { palpite_casa: 1, palpite_fora: 2 })
    expect(s.vocePosicao).toMatchObject({
      desfecho: 'fora',
      seguiuMaioria: false,
      pctMesmoPlacar: 10,
      cravouSozinho: true,
    })
  })

  it('trata partida sem palpites', () => {
    const s = computeMatchStats([], { casa: 1, fora: 0 })
    expect(s).toMatchObject({ total: 0, pctCasa: 0, placarMaisCravado: null, exatos: 0 })
  })
})
