'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { selectAll } from '@/lib/supabase/selectAll'
import { scoreMatch, type ScoreCfg } from '@/lib/scoring'
import { computeGroupStandings } from '@/lib/standings'
import { seedR32, computeBracketSlots, grupoLetra, buildActualSlots } from '@/lib/bracket'
import { standingsFromClassificacao } from '@/lib/matamata'
import { THIRD_PLACE_MATRIX } from '@/lib/thirdPlaceMatrix'
import type { BracketSlot, GroupMatchScore, StandingRow } from '@/lib/types'

// ============================================================================
// Motor de pontuação — recomputa TODAS as categorias e grava pontos_breakdown.
// Idempotente. Roda no sync de partidas e ao editar a config.
//
// Observações de fidelidade:
//  - Mata-mata pontua pelos 90' (placar_*_90); cai no placar cheio se ausente.
//  - Campeão/vice/3º vêm do RESULTADO real do jogo (Final/3º lugar). Se o jogo
//    foi decidido nos pênaltis (placar empatado), não dá para inferir o vencedor
//    aqui — o admin precisa registrar o placar decisivo. Nesse caso o bônus fica
//    pendente até haver um vencedor claro.
// ============================================================================

type PartidaRow = {
  id: string
  external_id: number
  status: string
  anulada: boolean
  grupo: string | null
  slot_key: string | null
  fase: string | null
  time_casa: string
  time_fora: string
  placar_casa: number | null
  placar_fora: number | null
  placar_casa_90: number | null
  placar_fora_90: number | null
}

type Breakdown = {
  pts_grupo_jogos: number
  pts_mata_jogos: number
  pts_classificacao: number
  pts_bracket: number
  pts_finais: number
}

function emptyBreakdown(): Breakdown {
  return { pts_grupo_jogos: 0, pts_mata_jogos: 0, pts_classificacao: 0, pts_bracket: 0, pts_finais: 0 }
}

const ROUND_RANK: Record<string, number> = { R32: 1, R16: 2, QF: 3, SF: 4, THIRD: 4, FINAL: 5 }

// Placar regulamentar usado na pontuação por partida.
function regScore(p: PartidaRow): [number, number] | null {
  if (p.grupo) {
    return p.placar_casa != null && p.placar_fora != null ? [p.placar_casa, p.placar_fora] : null
  }
  const c = p.placar_casa_90 ?? p.placar_casa
  const f = p.placar_fora_90 ?? p.placar_fora
  return c != null && f != null ? [c, f] : null
}

export async function recomputarTudo(): Promise<{ ok: boolean; message: string }> {
  const admin = createAdminClient()

  // Snapshot da classificação ANTES de recalcular (para mostrar movimentação).
  const { data: rankNow } = await admin
    .from('ranking')
    .select('user_id, pontos')
  if (rankNow && rankNow.length > 0) {
    const snaps = (rankNow as { user_id: string; pontos: number }[]).map((r, i) => ({
      user_id: r.user_id,
      posicao: i + 1,
      pontos: r.pontos,
      snapshot_at: new Date().toISOString(),
    }))
    await admin.from('ranking_snapshot').upsert(snaps, { onConflict: 'user_id' })
  }

  const { data: cfgRow, error: cfgErr } = await admin
    .from('scoring_config')
    .select('*')
    .eq('id', 1)
    .single()
  if (cfgErr || !cfgRow) return { ok: false, message: 'Config de pontuação não encontrada.' }
  const cfg = cfgRow as ScoreCfg & Record<string, number>

  const [partRes, tmplRes, aliasRes, surpRes] = await Promise.all([
    admin
      .from('partidas')
      .select(
        'id, external_id, status, anulada, grupo, slot_key, fase, time_casa, time_fora, placar_casa, placar_fora, placar_casa_90, placar_fora_90',
      ),
    admin.from('bracket_template').select('*'),
    admin.from('team_alias').select('alias, canonical'),
    admin.from('surpresa_elegivel').select('team_name, fifa_rank'),
  ])

  const partidas = (partRes.data ?? []) as PartidaRow[]
  const template = (tmplRes.data ?? []) as BracketSlot[]
  const matrix = THIRD_PLACE_MATRIX
  const aliasMap: Record<string, string> = {}
  for (const a of aliasRes.data ?? []) aliasMap[a.alias as string] = a.canonical as string
  const canon = (name: string) => aliasMap[name] ?? name
  const rankOfElegivel: Record<string, number> = {}
  for (const s of surpRes.data ?? []) rankOfElegivel[s.team_name as string] = s.fifa_rank as number

  const acc = new Map<string, Breakdown>()
  const bd = (uid: string) => {
    let b = acc.get(uid)
    if (!b) {
      b = emptyBreakdown()
      acc.set(uid, b)
    }
    return b
  }

  // ── 1+2) Pontuação por partida + bônus solitário ──────────────────────────
  const finished = partidas.filter((p) => p.status === 'FINISHED' && !p.anulada && regScore(p))
  const finishedIds = finished.map((p) => p.id)
  const regById = new Map(finished.map((p) => [p.id, regScore(p)!] as const))
  const isGroupById = new Map(finished.map((p) => [p.id, !!p.grupo] as const))

  type ScoredPalpite = {
    user_id: string
    partida_id: string
    palpite_casa: number
    palpite_fora: number
    categoria: string | null
    pts: number
    solitario: boolean
  }
  const scored: ScoredPalpite[] = []

  if (finishedIds.length > 0) {
    // Paginado: ~72 placares/usuário estouram o cap de 1000 do PostgREST.
    const palp = await selectAll<{ user_id: string; partida_id: string; palpite_casa: number; palpite_fora: number }>(
      (from, to) =>
        admin
          .from('palpites')
          .select('user_id, partida_id, palpite_casa, palpite_fora')
          .in('partida_id', finishedIds)
          .order('user_id')
          .order('partida_id')
          .range(from, to),
    )

    for (const pl of palp) {
      const reg = regById.get(pl.partida_id as string)
      if (!reg) continue
      const r = scoreMatch(pl.palpite_casa as number, pl.palpite_fora as number, reg[0], reg[1], cfg)
      scored.push({
        user_id: pl.user_id as string,
        partida_id: pl.partida_id as string,
        palpite_casa: pl.palpite_casa as number,
        palpite_fora: pl.palpite_fora as number,
        categoria: r.categoria,
        pts: r.pts,
        solitario: false,
      })
    }

    // Solitário: por jogo, se exatamente 1 palpite atingiu D ou F, ele ganha +2.
    const dfByPartida = new Map<string, ScoredPalpite[]>()
    for (const s of scored) {
      if (s.categoria === 'D' || s.categoria === 'F') {
        const arr = dfByPartida.get(s.partida_id) ?? []
        arr.push(s)
        dfByPartida.set(s.partida_id, arr)
      }
    }
    for (const arr of dfByPartida.values()) {
      if (arr.length === 1) {
        arr[0].solitario = true
        arr[0].pts += cfg.pts_solitario
      }
    }

    // Grava palpites (categoria, pontos, solitário) + acumula breakdown.
    const updates = scored.map((s) => ({
      user_id: s.user_id,
      partida_id: s.partida_id,
      palpite_casa: s.palpite_casa,
      palpite_fora: s.palpite_fora,
      categoria: s.categoria,
      solitario: s.solitario,
      pontos_obtidos: s.pts,
      updated_at: new Date().toISOString(),
    }))
    if (updates.length > 0) {
      const { error } = await admin.from('palpites').upsert(updates, { onConflict: 'user_id,partida_id' })
      if (error) return { ok: false, message: `Erro ao gravar pontos de partidas: ${error.message}` }
    }
    for (const s of scored) {
      const b = bd(s.user_id)
      if (isGroupById.get(s.partida_id)) b.pts_grupo_jogos += s.pts
      else b.pts_mata_jogos += s.pts
    }
  }

  // ── 3) Classificação dos grupos (apenas grupos completos) ─────────────────
  const groupPartidas = partidas.filter((p) => p.grupo)
  const byGroup = new Map<string, PartidaRow[]>()
  for (const p of groupPartidas) {
    const L = grupoLetra(p.grupo!)
    const arr = byGroup.get(L) ?? []
    arr.push(p)
    byGroup.set(L, arr)
  }
  const realStandings: Record<string, StandingRow[]> = {}
  for (const [L, jogos] of byGroup) {
    const complete = jogos.every((j) => j.status === 'FINISHED' && !j.anulada && regScore(j))
    if (!complete) continue
    const teams = Array.from(new Set(jogos.flatMap((j) => [j.time_casa, j.time_fora])))
    const matches: GroupMatchScore[] = jogos.map((j) => {
      const r = regScore(j)!
      return { home: j.time_casa, away: j.time_fora, homeGoals: r[0], awayGoals: r[1] }
    })
    realStandings[L] = computeGroupStandings(teams, matches)
  }

  // palpite_classificacao de todos os usuários (paginado: 48/usuário > cap 1000).
  // pontos_grupo/saldo/gols_pro são necessárias pra rankear os 3ºs na semeadura.
  const classRows = await selectAll<{
    user_id: string
    grupo: string
    posicao: number
    time: string
    pontos_grupo: number | null
    saldo: number | null
    gols_pro: number | null
  }>((from, to) =>
    admin
      .from('palpite_classificacao')
      .select('user_id, grupo, posicao, time, pontos_grupo, saldo, gols_pro')
      .order('user_id')
      .order('grupo')
      .order('posicao')
      .range(from, to),
  )
  const classByUser = new Map<
    string,
    { grupo: string; posicao: number; time: string; points: number; gd: number; gf: number }[]
  >()
  for (const c of classRows) {
    const arr = classByUser.get(c.user_id as string) ?? []
    arr.push({
      grupo: grupoLetra(c.grupo as string),
      posicao: c.posicao as number,
      time: c.time as string,
      points: c.pontos_grupo ?? 0,
      gd: c.saldo ?? 0,
      gf: c.gols_pro ?? 0,
    })
    classByUser.set(c.user_id as string, arr)
  }
  const classUpdates: { user_id: string; grupo: string; posicao: number; pontos_obtidos: number }[] = []
  for (const [uid, rows] of classByUser) {
    const b = bd(uid)
    const byG = new Map<string, typeof rows>()
    for (const r of rows) {
      const arr = byG.get(r.grupo) ?? []
      arr.push(r)
      byG.set(r.grupo, arr)
    }
    for (const [L, palRows] of byG) {
      const real = realStandings[L]
      if (!real) continue
      const realAt = new Map(real.map((r) => [r.position, r.team] as const))
      let acertos = 0
      for (const pr of palRows) {
        const correct = realAt.get(pr.posicao) === pr.time
        const pts = correct ? cfg.pts_posicao : 0
        if (correct) acertos++
        b.pts_classificacao += pts
        classUpdates.push({ user_id: uid, grupo: L, posicao: pr.posicao, pontos_obtidos: pts })
      }
      if (acertos === 4) b.pts_classificacao += cfg.pts_grupo_completo
    }
  }
  // Atualiza pontos por linha de classificação (grupo gravado como letra normalizada
  // pode divergir do valor original; por isso atualizamos por (user, posicao) dentro do grupo).
  for (const u of classUpdates) {
    await admin
      .from('palpite_classificacao')
      .update({ pontos_obtidos: u.pontos_obtidos })
      .eq('user_id', u.user_id)
      .eq('posicao', u.posicao)
      .ilike('grupo', `%${u.grupo}`)
  }

  // ── 4) Chaveamento (interseção de participantes por slot) ─────────────────
  // Confrontos reais por slot: ignora placeholders e dedup determinístico (ver
  // buildActualSlots). Sem isso, slots "undefined" zeram quem acertou e slot_keys
  // duplicados sobrescreviam o confronto de forma não-determinística.
  const actualSlots = buildActualSlots(partidas)
  const ptsPerSlot = new Map(template.map((s) => [s.slot_key, s.points_per_slot] as const))

  // Paginado: ~32 picks/usuário estouram o cap de 1000 do PostgREST.
  const brkRows = await selectAll<{ user_id: string; slot_key: string; time: string }>((from, to) =>
    admin
      .from('palpite_bracket')
      .select('user_id, slot_key, time')
      .order('user_id')
      .order('slot_key')
      .range(from, to),
  )
  const picksByUser = new Map<string, Record<string, string>>()
  for (const b of brkRows) {
    const m = picksByUser.get(b.user_id as string) ?? {}
    m[b.slot_key as string] = b.time as string
    picksByUser.set(b.user_id as string, m)
  }

  const brkUpdates: { user_id: string; slot_key: string; pontos_obtidos: number; acertou: boolean }[] = []
  for (const [uid, picks] of picksByUser) {
    // Reconstrói a classificação do usuário p/ semear o R32 (preservando pts/SG/GP
    // — necessárias pra rankear os 3ºs colocados, idêntico ao wizard).
    const userClass = classByUser.get(uid) ?? []
    const standingsByGroup = standingsFromClassificacao(userClass)
    const { r32 } = seedR32(standingsByGroup, template, matrix)
    const predicted = computeBracketSlots(template, r32, picks)

    const b = bd(uid)
    for (const s of template) {
      // Só pontuamos slots em que o usuário escolheu quem avança. Os demais
      // não geram linha em palpite_bracket.
      if (picks[s.slot_key] == null) continue
      // Sem confronto real definido ainda (slot vazio/placeholder) → zera a linha.
      // Crucial: precisamos GRAVAR 0 para não deixar pontos_obtidos defasado de
      // um cálculo anterior (era a origem do bracket somar no slot mas 0 no ranking).
      const actual = actualSlots[s.slot_key]
      let slotPts = 0
      let acertou = false
      if (actual) {
        const pred = predicted[s.slot_key] ?? { home: null, away: null }
        const predSet = new Set([pred.home, pred.away].filter(Boolean) as string[])
        const actualTeams = [actual.home, actual.away].filter(Boolean) as string[]
        const inter = actualTeams.filter((t) => predSet.has(t)).length
        slotPts = (ptsPerSlot.get(s.slot_key) ?? 0) * inter
        acertou = inter === 2
      }
      b.pts_bracket += slotPts
      brkUpdates.push({ user_id: uid, slot_key: s.slot_key, pontos_obtidos: slotPts, acertou })
    }
  }
  if (brkUpdates.length > 0) {
    for (const u of brkUpdates) {
      await admin
        .from('palpite_bracket')
        .update({ pontos_obtidos: u.pontos_obtidos, acertou: u.acertou })
        .eq('user_id', u.user_id)
        .eq('slot_key', u.slot_key)
    }
  }

  // ── 5) Bônus finais (campeão / vice / 3º / surpresa) ──────────────────────
  const finalP = partidas.find((p) => p.slot_key === 'FINAL' || p.fase === 'FINAL')
  const thirdP = partidas.find((p) => p.slot_key === 'THIRD' || p.fase === 'THIRD_PLACE')
  const decisivo = (p?: PartidaRow): { winner: string | null; loser: string | null } => {
    if (!p || p.status !== 'FINISHED' || p.placar_casa == null || p.placar_fora == null)
      return { winner: null, loser: null }
    if (p.placar_casa === p.placar_fora) return { winner: null, loser: null } // pênaltis: indefinido aqui
    const homeWins = p.placar_casa > p.placar_fora
    return {
      winner: homeWins ? p.time_casa : p.time_fora,
      loser: homeWins ? p.time_fora : p.time_casa,
    }
  }
  const fin = decisivo(finalP)
  const champion = fin.winner
  const runnerUp = fin.loser
  const third = decisivo(thirdP).winner

  // Surpresa real: elegível que foi mais longe; desempate por pior rank.
  // Só conta partidas FINISHED para não premiar rounds ainda não disputados.
  const furthest = new Map<string, number>()
  for (const p of partidas) {
    if (!p.slot_key || p.status !== 'FINISHED') continue
    const round = p.slot_key.split('-')[0]
    const rank = ROUND_RANK[round] ?? 0
    for (const t of [p.time_casa, p.time_fora]) {
      const c = canon(t)
      if (rankOfElegivel[c] == null) continue
      furthest.set(c, Math.max(furthest.get(c) ?? 0, rank))
    }
  }
  let actualSurpresa: string | null = null
  let bestRound = -1
  let worstRank = -1
  for (const [team, round] of furthest) {
    const rk = rankOfElegivel[team] ?? 0
    if (round > bestRound || (round === bestRound && rk > worstRank)) {
      bestRound = round
      worstRank = rk
      actualSurpresa = team
    }
  }

  const { data: finalRows } = await admin
    .from('palpite_final')
    .select('user_id, campeao, vice, terceiro, surpresa')
  const finalUpdates: {
    user_id: string
    pontos_campeao: number
    pontos_vice: number
    pontos_terceiro: number
    pontos_surpresa: number
  }[] = []
  for (const f of finalRows ?? []) {
    const uid = f.user_id as string
    const pc = champion && f.campeao === champion ? cfg.pts_campeao : 0
    const pv = runnerUp && f.vice === runnerUp ? cfg.pts_vice : 0
    const pt = third && f.terceiro === third ? cfg.pts_terceiro : 0
    const ps = actualSurpresa && canon((f.surpresa as string) ?? '') === actualSurpresa ? cfg.pts_surpresa : 0
    bd(uid).pts_finais += pc + pv + pt + ps
    finalUpdates.push({ user_id: uid, pontos_campeao: pc, pontos_vice: pv, pontos_terceiro: pt, pontos_surpresa: ps })
  }
  for (const u of finalUpdates) {
    await admin
      .from('palpite_final')
      .update({
        pontos_campeao: u.pontos_campeao,
        pontos_vice: u.pontos_vice,
        pontos_terceiro: u.pontos_terceiro,
        pontos_surpresa: u.pontos_surpresa,
      })
      .eq('user_id', u.user_id)
  }

  // ── 6) Grava pontos_breakdown ─────────────────────────────────────────────
  // Garante uma linha por usuário com algum palpite (zera quem não pontuou).
  const { data: allProfiles } = await admin.from('profiles').select('id')
  const breakdownRows = (allProfiles ?? []).map((pr) => {
    const b = acc.get(pr.id as string) ?? emptyBreakdown()
    return {
      user_id: pr.id as string,
      pts_grupo_jogos: b.pts_grupo_jogos,
      pts_mata_jogos: b.pts_mata_jogos,
      pts_classificacao: b.pts_classificacao,
      pts_bracket: b.pts_bracket,
      pts_finais: b.pts_finais,
      updated_at: new Date().toISOString(),
    }
  })
  if (breakdownRows.length > 0) {
    const { error } = await admin.from('pontos_breakdown').upsert(breakdownRows, { onConflict: 'user_id' })
    if (error) return { ok: false, message: `Erro ao gravar breakdown: ${error.message}` }
  }

  return { ok: true, message: 'Pontuação recalculada.' }
}
