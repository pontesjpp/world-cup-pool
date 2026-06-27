// Lógica PURA do chaveamento do mata-mata (sem React, sem Supabase).
//
// Responsabilidades:
//  - selecionar os 8 melhores 3ºs colocados entre os 12 grupos;
//  - semear os 32 confrontos do R32 a partir da classificação derivada e do
//    template oficial FIFA 2026 (`bracket_template`) + tabela dos 3ºs
//    (`third_place_matrix`);
//  - propagar as escolhas do usuário (quem avança) por R16 → QF → SF → 3º/Final;
//  - detectar escolhas "stale" (time que deixou de ser participante do slot).
//
// O módulo é genérico: trabalha com qualquer template/matriz que o banco
// fornecer. A correção do resultado depende da fidelidade dos dados semeados.

import type { BracketSlot, StandingRow } from './types'

export type Side = 'home' | 'away'
export type SlotParticipants = { home: string | null; away: string | null }
// assignment: chave "<slot_key>.<side>" -> "3X" (3º colocado do grupo X)
export type ThirdAssignment = Record<string, string>

const ROUND_ORDER: BracketSlot['round'][] = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']

// "Group A" / "Grupo A" / "A" -> "A"
export function grupoLetra(grupo: string): string {
  const m = grupo.trim().match(/([A-L])\s*$/i)
  return m ? m[1].toUpperCase() : grupo.trim().toUpperCase()
}

function cmpStanding(a: StandingRow, b: StandingRow, rankOf?: (t: string) => number): number {
  if (b.points !== a.points) return b.points - a.points
  if (b.gd !== a.gd) return b.gd - a.gd
  if (b.gf !== a.gf) return b.gf - a.gf
  if (rankOf) {
    const r = rankOf(a.team) - rankOf(b.team)
    if (r !== 0) return r
  }
  return a.team.localeCompare(b.team)
}

/**
 * Seleciona os 8 melhores terceiros colocados entre os grupos.
 * Retorna os qualificados (com a letra do grupo) e o `comboKey`
 * (letras dos grupos classificados, ordenadas) usado na third_place_matrix.
 */
export function pickBestThirds(
  standingsByGroup: Record<string, StandingRow[]>,
  rankOf?: (t: string) => number,
): { qualifiers: { group: string; row: StandingRow }[]; comboKey: string } {
  const thirds: { group: string; row: StandingRow }[] = []
  for (const [group, rows] of Object.entries(standingsByGroup)) {
    const third = rows.find((r) => r.position === 3)
    if (third) thirds.push({ group, row: third })
  }
  thirds.sort((a, b) => cmpStanding(a.row, b.row, rankOf))
  const qualifiers = thirds.slice(0, 8)
  const comboKey = qualifiers
    .map((q) => q.group)
    .sort()
    .join('')
  return { qualifiers, comboKey }
}

export type ThirdRankEntry = {
  group: string
  row: StandingRow
  rank: number
  qualifies: boolean
}

/**
 * Ranqueia TODOS os 3ºs colocados dos grupos (mesma ordenação de pts/SG/GP/rank
 * usada na semeadura), atribuindo posição global e marcando quem fica acima da
 * linha de corte (`advanceCount` melhores avançam). Usado pela aba "3 Lugares".
 */
export function rankAllThirds(
  standingsByGroup: Record<string, StandingRow[]>,
  advanceCount = 8,
  rankOf?: (t: string) => number,
): ThirdRankEntry[] {
  const thirds: { group: string; row: StandingRow }[] = []
  for (const [group, rows] of Object.entries(standingsByGroup)) {
    const third = rows.find((r) => r.position === 3)
    if (third) thirds.push({ group, row: third })
  }
  thirds.sort((a, b) => cmpStanding(a.row, b.row, rankOf))
  return thirds.map((t, i) => ({ group: t.group, row: t.row, rank: i + 1, qualifies: i < advanceCount }))
}

function teamAt(rows: StandingRow[] | undefined, position: number): string | null {
  return rows?.find((r) => r.position === position)?.team ?? null
}

// Nome de placeholder (não é um time real). Seeds incompletos chegam a gravar a
// string literal "undefined"; jogos sem confronto definido usam "a definir".
function isRealTeamName(name: string | null | undefined): name is string {
  const v = name?.trim().toLowerCase()
  return !!v && v !== 'undefined' && v !== 'null' && v !== 'a definir'
}

type ActualSlotRow = {
  slot_key: string | null
  grupo: string | null
  time_casa: string
  time_fora: string
  external_id: number
}

/**
 * Monta os confrontos REAIS por slot a partir das linhas de `partidas` do
 * mata-mata (grupo NULL, slot_key definido). É a fonte de verdade para a
 * pontuação do bracket e para a UI do mata-mata.
 *
 * Robustez:
 *  - ignora slots com time placeholder ("undefined"/"a definir") — ainda não
 *    determinados, não devem pontuar ninguém;
 *  - resolve slot_keys DUPLICADOS de forma determinística, preferindo a linha
 *    curada manualmente (external_id < 0), já que o admin mantém os confrontos
 *    à mão. (Conflitos transitórios — ex.: jogo da API atribuído ao slot errado
 *    — somem no próximo sync, que realoca e remove a linha manual coberta.)
 */
export function buildActualSlots(rows: ActualSlotRow[]): Record<string, SlotParticipants> {
  const chosen: Record<string, { home: string; away: string; ext: number }> = {}
  for (const p of rows) {
    if (!p.slot_key || p.grupo) continue
    if (!isRealTeamName(p.time_casa) || !isRealTeamName(p.time_fora)) continue
    const cur = chosen[p.slot_key]
    // Mantém a primeira válida; só troca se a atual é da API (>0) e a nova é manual (<0).
    if (!cur || (cur.ext > 0 && p.external_id < 0)) {
      chosen[p.slot_key] = { home: p.time_casa, away: p.time_fora, ext: p.external_id }
    }
  }
  const out: Record<string, SlotParticipants> = {}
  for (const [k, v] of Object.entries(chosen)) out[k] = { home: v.home, away: v.away }
  return out
}

/**
 * Resolve um token de origem do R32 (ex: '1A', '2B', ou um placeholder de 3º)
 * para o nome concreto do time, dada a classificação derivada.
 */
function resolveR32Source(
  token: string | null,
  slotKey: string,
  side: Side,
  standingsByGroup: Record<string, StandingRow[]>,
  thirdsByGroup: Record<string, string>,
  assignment: ThirdAssignment | null,
): string | null {
  if (!token) return null
  const t = token.trim().toUpperCase()
  // '1X' / '2X' — vencedor / vice direto do grupo X
  const direct = t.match(/^([12])([A-L])$/)
  if (direct) {
    const pos = Number(direct[1])
    return teamAt(standingsByGroup[direct[2]], pos)
  }
  // '3X' literal — 3º do grupo X
  const lit3 = t.match(/^3([A-L])$/)
  if (lit3) return thirdsByGroup[lit3[1]] ?? null
  // Placeholder genérico de 3º ('3RD', '3rd-...') — resolve via assignment.
  if (t.startsWith('3')) {
    const assigned = assignment?.[`${slotKey}.${side}`]
    if (!assigned) return null
    const g = assigned.trim().toUpperCase().match(/^3?([A-L])$/)
    return g ? (thirdsByGroup[g[1]] ?? null) : null
  }
  return null
}

/**
 * Semeia os 32 confrontos do R32 a partir da classificação derivada.
 * Retorna os participantes de cada slot R32 + diagnóstico do combo de 3ºs.
 */
export function seedR32(
  standingsByGroup: Record<string, StandingRow[]>,
  template: BracketSlot[],
  matrix: Record<string, ThirdAssignment>,
  rankOf?: (t: string) => number,
): {
  r32: Record<string, SlotParticipants>
  comboKey: string
  matrixHit: boolean
} {
  const { qualifiers, comboKey } = pickBestThirds(standingsByGroup, rankOf)
  const qualifiedGroups = new Set(qualifiers.map((q) => q.group))
  const thirdsByGroup: Record<string, string> = {}
  for (const q of qualifiers) {
    const name = q.row.team
    if (name) thirdsByGroup[q.group] = name
  }

  let assignment: ThirdAssignment | null = matrix[comboKey] ?? null
  const matrixHit = assignment != null

  // Fallback determinístico se o combo não estiver na matriz oficial: distribui
  // os 3ºs qualificados (por ranking) nos slots de 3º do template, em ordem.
  if (!assignment) {
    assignment = {}
    const thirdSlots: { key: string; side: Side }[] = []
    for (const s of template.filter((x) => x.round === 'R32')) {
      if (s.source_home && s.source_home.trim().toUpperCase().startsWith('3'))
        thirdSlots.push({ key: s.slot_key, side: 'home' })
      if (s.source_away && s.source_away.trim().toUpperCase().startsWith('3'))
        thirdSlots.push({ key: s.slot_key, side: 'away' })
    }
    qualifiers.forEach((q, i) => {
      const slot = thirdSlots[i]
      if (slot) assignment![`${slot.key}.${slot.side}`] = `3${q.group}`
    })
  }

  void qualifiedGroups // documentação: usado implicitamente via thirdsByGroup
  const r32: Record<string, SlotParticipants> = {}
  for (const s of template.filter((x) => x.round === 'R32')) {
    r32[s.slot_key] = {
      home: resolveR32Source(s.source_home, s.slot_key, 'home', standingsByGroup, thirdsByGroup, assignment),
      away: resolveR32Source(s.source_away, s.slot_key, 'away', standingsByGroup, thirdsByGroup, assignment),
    }
  }
  return { r32, comboKey, matrixHit }
}

/**
 * Calcula os participantes de TODOS os slots, propagando as escolhas do usuário
 * (picks: slot_key -> nome do time que avança). 3º/4º lugar (THIRD) recebe os
 * PERDEDORES das semifinais.
 */
export function computeBracketSlots(
  template: BracketSlot[],
  r32: Record<string, SlotParticipants>,
  picks: Record<string, string>,
): Record<string, SlotParticipants> {
  const byKey = new Map(template.map((s) => [s.slot_key, s]))
  const slots: Record<string, SlotParticipants> = {}

  const winnerOf = (slotKey: string | null): string | null =>
    slotKey ? (picks[slotKey] ?? null) : null

  const loserOf = (slotKey: string | null): string | null => {
    if (!slotKey) return null
    const p = slots[slotKey]
    const w = picks[slotKey]
    if (!p || !w) return null
    if (p.home === w) return p.away
    if (p.away === w) return p.home
    return null
  }

  // Processa em ordem de rodada para que dependências já estejam resolvidas.
  for (const round of ROUND_ORDER) {
    for (const s of template.filter((x) => x.round === round)) {
      if (round === 'R32') {
        slots[s.slot_key] = r32[s.slot_key] ?? { home: null, away: null }
      } else if (round === 'THIRD') {
        slots[s.slot_key] = {
          home: loserOf(s.feeds_from_home),
          away: loserOf(s.feeds_from_away),
        }
      } else {
        slots[s.slot_key] = {
          home: winnerOf(s.feeds_from_home),
          away: winnerOf(s.feeds_from_away),
        }
      }
    }
  }
  void byKey
  return slots
}

/**
 * Retorna os slots cujo pick deixou de ser participante válido (precisa revisão)
 * — tipicamente após o usuário trocar um vencedor numa rodada anterior.
 */
export function detectStale(
  slots: Record<string, SlotParticipants>,
  picks: Record<string, string>,
): Set<string> {
  const stale = new Set<string>()
  for (const [slotKey, pick] of Object.entries(picks)) {
    const p = slots[slotKey]
    if (!p) continue
    if (pick !== p.home && pick !== p.away) stale.add(slotKey)
  }
  return stale
}

/**
 * Limpa picks stale em cascata até estabilizar (uma troca pode invalidar vários
 * slots a jusante). Retorna um novo objeto de picks.
 */
export function prunePicks(
  template: BracketSlot[],
  r32: Record<string, SlotParticipants>,
  picks: Record<string, string>,
): Record<string, string> {
  let current = { ...picks }
  for (let guard = 0; guard < template.length + 1; guard++) {
    const slots = computeBracketSlots(template, r32, current)
    const stale = detectStale(slots, current)
    if (stale.size === 0) break
    const next = { ...current }
    for (const k of stale) delete next[k]
    current = next
  }
  return current
}

/** Deriva campeão / vice / 3º a partir do template e dos picks. */
export function deriveFinais(
  template: BracketSlot[],
  slots: Record<string, SlotParticipants>,
  picks: Record<string, string>,
): { campeao: string | null; vice: string | null; terceiro: string | null } {
  const finalKey = template.find((s) => s.round === 'FINAL')?.slot_key ?? 'FINAL'
  const thirdKey = template.find((s) => s.round === 'THIRD')?.slot_key ?? 'THIRD'
  const campeao = picks[finalKey] ?? null
  const finalSlot = slots[finalKey]
  const vice = finalSlot ? (campeao === finalSlot.home ? finalSlot.away : finalSlot.home) : null
  const terceiro = picks[thirdKey] ?? null
  return { campeao, vice, terceiro }
}
