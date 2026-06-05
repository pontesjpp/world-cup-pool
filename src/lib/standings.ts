// Derivação de classificação de grupo a partir de placares palpitados.
//
// Módulo PURO (sem React, sem Supabase) — usado tanto no cliente (preview ao
// vivo na wizard pré-copa) quanto no servidor (congelar a classificação
// canônica e derivar o resultado real dos grupos para pontuar).
//
// Critérios oficiais FIFA (fase de grupos), aplicados em ordem ao subconjunto
// ainda empatado:
//   1. pontos          2. saldo de gols       3. gols pró
//   4. confronto direto entre os empatados (pontos → saldo → gols pró)
//   5. fair-play / sorteio  — NÃO deriváveis de placares; usamos um fallback
//      determinístico (rank FIFA, se houver, senão alfabético) e marcamos
//      `tiebreakByLot = true` para a UI sinalizar "critério final no sorteio".

import type { GroupMatchScore, StandingRow } from './types'

type Row = {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
  position: number
  tiebreakByLot: boolean
}

type Triple = { pts: number; gd: number; gf: number }

function blank(team: string): Row {
  return {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    position: 0,
    tiebreakByLot: false,
  }
}

function cmpTriple(a: Triple, b: Triple): number {
  if (b.pts !== a.pts) return b.pts - a.pts
  if (b.gd !== a.gd) return b.gd - a.gd
  return b.gf - a.gf
}

function equalTriple(a: Triple, b: Triple): boolean {
  return a.pts === b.pts && a.gd === b.gd && a.gf === b.gf
}

// Mini-tabela de confronto direto restrita a um subconjunto de times.
function headToHead(subset: Row[], matches: GroupMatchScore[]): Map<string, Triple> {
  const names = new Set(subset.map((r) => r.team))
  const h2h = new Map<string, Triple>()
  for (const r of subset) h2h.set(r.team, { pts: 0, gd: 0, gf: 0 })

  for (const m of matches) {
    if (m.homeGoals == null || m.awayGoals == null) continue
    if (!names.has(m.home) || !names.has(m.away)) continue
    const H = h2h.get(m.home)!
    const A = h2h.get(m.away)!
    H.gf += m.homeGoals
    A.gf += m.awayGoals
    H.gd += m.homeGoals - m.awayGoals
    A.gd += m.awayGoals - m.homeGoals
    if (m.homeGoals > m.awayGoals) H.pts += 3
    else if (m.homeGoals < m.awayGoals) A.pts += 3
    else {
      H.pts += 1
      A.pts += 1
    }
  }
  return h2h
}

// Ordena `run` (já empatado em pontos/saldo/gols pró no geral) in-place.
function resolveTie(
  run: Row[],
  matches: GroupMatchScore[],
  rankOf?: (team: string) => number,
): void {
  if (run.length <= 1) return

  const h2h = headToHead(run, matches)
  run.sort((x, y) => cmpTriple(h2h.get(x.team)!, h2h.get(y.team)!))

  // Reavalia sub-corridas ainda empatadas no confronto direto.
  let i = 0
  while (i < run.length) {
    let j = i + 1
    while (j < run.length && equalTriple(h2h.get(run[i].team)!, h2h.get(run[j].team)!)) j++
    const sub = run.slice(i, j)
    if (sub.length > 1) {
      if (sub.length === run.length) {
        // Confronto direto não separou nada → critério determinístico.
        sub.sort(fallbackCmp(rankOf))
        for (const r of sub) r.tiebreakByLot = true
      } else {
        // Reinicia os critérios (do topo) para o subconjunto remanescente.
        resolveTie(sub, matches, rankOf)
      }
      for (let k = 0; k < sub.length; k++) run[i + k] = sub[k]
    }
    i = j
  }
}

function fallbackCmp(rankOf?: (team: string) => number) {
  return (a: Row, b: Row): number => {
    if (rankOf) {
      const ra = rankOf(a.team)
      const rb = rankOf(b.team)
      if (ra !== rb) return ra - rb // rank menor = melhor
    }
    return a.team.localeCompare(b.team)
  }
}

/**
 * Deriva a classificação de um grupo a partir dos placares palpitados.
 * Apenas jogos com os dois placares preenchidos contam.
 *
 * @param teams  os 4 times do grupo (por nome)
 * @param matches os jogos do grupo com placares (null = não preenchido)
 * @param rankOf  opcional — rank FIFA por time (menor = melhor) p/ desempate final
 */
export function computeGroupStandings(
  teams: string[],
  matches: GroupMatchScore[],
  rankOf?: (team: string) => number,
): StandingRow[] {
  const stats = new Map<string, Row>()
  for (const t of teams) stats.set(t, blank(t))

  for (const m of matches) {
    if (m.homeGoals == null || m.awayGoals == null) continue
    const h = stats.get(m.home)
    const a = stats.get(m.away)
    if (!h || !a) continue

    h.played++
    a.played++
    h.gf += m.homeGoals
    h.ga += m.awayGoals
    a.gf += m.awayGoals
    a.ga += m.homeGoals

    if (m.homeGoals > m.awayGoals) {
      h.won++
      a.lost++
      h.points += 3
    } else if (m.homeGoals < m.awayGoals) {
      a.won++
      h.lost++
      a.points += 3
    } else {
      h.drawn++
      a.drawn++
      h.points += 1
      a.points += 1
    }
  }

  for (const r of stats.values()) r.gd = r.gf - r.ga

  const rows = [...stats.values()]
  // Critérios gerais (1–3).
  rows.sort((x, y) =>
    cmpTriple({ pts: x.points, gd: x.gd, gf: x.gf }, { pts: y.points, gd: y.gd, gf: y.gf }),
  )

  // Resolve corridas empatadas em (pontos, saldo, gols pró).
  let i = 0
  while (i < rows.length) {
    let j = i + 1
    while (
      j < rows.length &&
      rows[i].points === rows[j].points &&
      rows[i].gd === rows[j].gd &&
      rows[i].gf === rows[j].gf
    )
      j++
    if (j - i > 1) {
      const run = rows.slice(i, j)
      resolveTie(run, matches, rankOf)
      for (let k = 0; k < run.length; k++) rows[i + k] = run[k]
    }
    i = j
  }

  rows.forEach((r, idx) => (r.position = idx + 1))
  return rows
}
