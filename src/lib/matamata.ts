// Reconstrução PURA do bracket de um usuário para a aba "Mata-mata" (read-only).
//
// É exatamente o que `recomputarTudo` (src/actions/scoring.ts §4) faz por
// participante: a classificação palpitada dos grupos semeia o R32, e as escolhas
// (palpite_bracket) propagam os vencedores pela árvore. Aqui isolamos essa
// montagem para reuso na UI e em testes.

import { grupoLetra, seedR32, computeBracketSlots, type SlotParticipants, type ThirdAssignment } from './bracket'
import type { BracketSlot, StandingRow } from './types'

// Linha de palpite_classificacao (posição palpitada de um time num grupo).
export type ClassRow = { grupo: string; posicao: number; time: string }

// Monta StandingRow[] por grupo a partir só de posição+time (stats zeradas — não
// importam pra semeadura, que usa apenas a posição). Espelha scoring.ts §4.
export function standingsFromClassificacao(
  classificacao: ClassRow[],
): Record<string, StandingRow[]> {
  const byG = new Map<string, { posicao: number; time: string }[]>()
  for (const r of classificacao) {
    const L = grupoLetra(r.grupo)
    const arr = byG.get(L) ?? []
    arr.push({ posicao: r.posicao, time: r.time })
    byG.set(L, arr)
  }
  const standingsByGroup: Record<string, StandingRow[]> = {}
  for (const [L, rows] of byG) {
    standingsByGroup[L] = rows
      .sort((a, b) => a.posicao - b.posicao)
      .map((r) => ({
        team: r.time,
        position: r.posicao,
        points: 0,
        gd: 0,
        gf: 0,
        ga: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        tiebreakByLot: false,
      }))
  }
  return standingsByGroup
}

/**
 * Reconstrói os participantes de todos os slots do bracket de um usuário.
 * @param template   bracket_template
 * @param matrix     third_place_matrix (THIRD_PLACE_MATRIX)
 * @param classificacao linhas de palpite_classificacao do usuário
 * @param picks      palpite_bracket do usuário (slot_key -> time que avança)
 */
export function buildUserSlots(
  template: BracketSlot[],
  matrix: Record<string, ThirdAssignment>,
  classificacao: ClassRow[],
  picks: Record<string, string>,
): Record<string, SlotParticipants> {
  const standingsByGroup = standingsFromClassificacao(classificacao)
  const { r32 } = seedR32(standingsByGroup, template, matrix)
  return computeBracketSlots(template, r32, picks)
}
