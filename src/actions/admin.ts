'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recomputarTudo } from '@/actions/scoring'
import { computeBracketSlots } from '@/lib/bracket'
import { KNOCKOUT_SCHEDULE, FASE_LABEL } from '@/lib/knockoutSchedule'
import type { BracketSlot } from '@/lib/types'

// Garante que o caller é admin; lança erro caso contrário.
async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) throw new Error('Acesso restrito a administradores')
}

const FOOTBALL_API = 'https://api.football-data.org/v4/competitions/WC/matches'

type FootballMatch = {
  id: number
  utcDate: string
  status: string
  stage?: string
  group?: string | null
  homeTeam: { name?: string | null; crest?: string | null }
  awayTeam: { name?: string | null; crest?: string | null }
  score?: { fullTime?: { home?: number | null; away?: number | null } }
}

type ManualSlot = { slot_key: string | null; time_casa: string; time_fora: string | null }

// Placeholders que NÃO são times reais e não podem virar chave do mapa
// (linhas de seed incompletas chegam a gravar a string literal "undefined").
function isRealTeam(name: string | null | undefined): name is string {
  const v = name?.trim().toLowerCase()
  return !!v && v !== 'undefined' && v !== 'null' && v !== 'a definir'
}

// Constrói um mapa time_name (lowercase) → slot_key a partir dos registros manuais.
// Cada time aparece exatamente uma vez no chaveamento, então o mapeamento é único.
function buildTeamToSlotMap(manualSlots: ManualSlot[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of manualSlots) {
    if (!r.slot_key) continue
    if (isRealTeam(r.time_casa)) map.set(r.time_casa.toLowerCase(), r.slot_key)
    if (isRealTeam(r.time_fora)) map.set(r.time_fora.toLowerCase(), r.slot_key)
  }
  return map
}

// Status da API que mapeamos direto para o enum match_status do banco.
const STATUS_VALIDOS = new Set([
  'SCHEDULED',
  'TIMED',
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'POSTPONED',
  'CANCELLED',
])

function mapStatus(s: string): string {
  return STATUS_VALIDOS.has(s) ? s : 'SCHEDULED'
}

export type SyncResult = { ok: boolean; total?: number; message: string }

// Busca os jogos da Copa na football-data.org e faz upsert por external_id,
// depois recalcula a pontuação dos jogos já encerrados.
export async function sincronizarPartidas(): Promise<SyncResult> {
  await assertAdmin()

  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) {
    return { ok: false, message: 'FOOTBALL_API_KEY não configurada no ambiente.' }
  }

  let matches: FootballMatch[]
  try {
    const res = await fetch(FOOTBALL_API, {
      headers: { 'X-Auth-Token': apiKey },
      cache: 'no-store',
    })
    if (!res.ok) {
      return { ok: false, message: `API retornou ${res.status} ${res.statusText}` }
    }
    const json = (await res.json()) as { matches?: FootballMatch[] }
    matches = json.matches ?? []
  } catch (e) {
    return { ok: false, message: `Falha ao acessar a API: ${(e as Error).message}` }
  }

  const admin = createAdminClient()

  // Transfere slot_keys dos registros manuais (ext_id < 0) para os da API,
  // casando pelo nome do time (cada time aparece exatamente uma vez no bracket).
  const { data: manualSlots } = await admin
    .from('partidas')
    .select('slot_key, time_casa, time_fora')
    .is('grupo', null)
    .lt('external_id', 0)
    .not('slot_key', 'is', null)

  const teamToSlot = buildTeamToSlotMap(manualSlots ?? [])

  // Preserva slot_keys já gravados no banco para não apagá-los no upsert quando
  // não há registro manual correspondente (ex.: slot atribuído via SQL direto).
  const { data: existingKnockout } = await admin
    .from('partidas')
    .select('external_id, slot_key')
    .is('grupo', null)
    .gt('external_id', 0)
    .not('slot_key', 'is', null)
  const existingSlotMap = new Map<number, string>()
  for (const r of (existingKnockout ?? []) as { external_id: number; slot_key: string }[]) {
    existingSlotMap.set(r.external_id, r.slot_key)
  }

  // Protege placares de jogos já encerrados manualmente: a API não sobrescreve
  // placar_casa/placar_fora nem o status FINISHED gravado no banco.
  const { data: finishedRows } = await admin
    .from('partidas')
    .select('external_id, placar_casa, placar_fora')
    .eq('status', 'FINISHED')
    .gt('external_id', 0)
  const finishedMap = new Map<number, { placar_casa: number | null; placar_fora: number | null }>()
  for (const r of (finishedRows ?? []) as { external_id: number; placar_casa: number | null; placar_fora: number | null }[]) {
    finishedMap.set(r.external_id, { placar_casa: r.placar_casa, placar_fora: r.placar_fora })
  }

  const rows = matches
    .filter((m) => m.homeTeam?.name && m.awayTeam?.name)
    .map((m) => {
      const slotByHome = teamToSlot.get((m.homeTeam.name ?? '').toLowerCase())
      const slotByAway = teamToSlot.get((m.awayTeam.name ?? '').toLowerCase())
      const locked = finishedMap.get(m.id)
      return {
        external_id: m.id,
        time_casa: m.homeTeam.name as string,
        time_fora: m.awayTeam.name as string,
        crest_casa: m.homeTeam.crest ?? null,
        crest_fora: m.awayTeam.crest ?? null,
        data_jogo: m.utcDate,
        status: locked ? 'FINISHED' : mapStatus(m.status),
        placar_casa: locked ? locked.placar_casa : m.score?.fullTime?.home ?? null,
        placar_fora: locked ? locked.placar_fora : m.score?.fullTime?.away ?? null,
        fase: m.stage ?? null,
        grupo: m.group ?? null,
        slot_key: slotByHome ?? slotByAway ?? existingSlotMap.get(m.id) ?? null,
        updated_at: new Date().toISOString(),
      }
    })

  if (rows.length === 0) {
    return {
      ok: true,
      total: 0,
      message: 'Nenhum jogo com times definidos ainda (sorteio pendente).',
    }
  }
  const { error: upsertError } = await admin
    .from('partidas')
    .upsert(rows, { onConflict: 'external_id' })

  if (upsertError) {
    return { ok: false, message: `Erro ao salvar partidas: ${upsertError.message}` }
  }

  // Remove registros manuais (ext_id < 0) cujos slot_keys agora têm registro da API.
  const coveredSlots = rows.filter((r) => r.slot_key).map((r) => r.slot_key!)
  if (coveredSlots.length > 0) {
    await admin.from('partidas').delete().lt('external_id', 0).in('slot_key', coveredSlots)
  }

  const rec = await recomputarTudo()
  if (!rec.ok) {
    return { ok: false, message: `Partidas salvas, mas falha ao pontuar: ${rec.message}` }
  }

  revalidatePath('/')
  revalidatePath('/ranking')
  revalidatePath('/realizadas')
  revalidatePath('/mata-mata')
  const slotsMsg = coveredSlots.length > 0 ? ` (${coveredSlots.length} slots do mata-mata atribuídos)` : ''
  return { ok: true, total: rows.length, message: `${rows.length} partidas sincronizadas${slotsMsg}.` }
}

// Atualiza as regras de pontuação (hierarquia completa) + prazos e recalcula.
export async function atualizarConfig(
  _prevState: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  await assertAdmin()

  const toInt = (v: FormDataEntryValue | null, def: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : def
  }

  const dl = formData.get('precopa_deadline') as string | null

  const admin = createAdminClient()
  const { error } = await admin
    .from('scoring_config')
    .update({
      pts_a: toInt(formData.get('pts_a'), 3),
      pts_b: toInt(formData.get('pts_b'), 4),
      pts_c: toInt(formData.get('pts_c'), 4),
      pts_d: toInt(formData.get('pts_d'), 5),
      pts_e: toInt(formData.get('pts_e'), 3),
      pts_f: toInt(formData.get('pts_f'), 5),
      pts_p: toInt(formData.get('pts_p'), 1),
      pts_solitario: toInt(formData.get('pts_solitario'), 2),
      pts_posicao: toInt(formData.get('pts_posicao'), 1),
      pts_grupo_completo: toInt(formData.get('pts_grupo_completo'), 3),
      pts_terceiro: toInt(formData.get('pts_terceiro'), 15),
      pts_vice: toInt(formData.get('pts_vice'), 18),
      pts_campeao: toInt(formData.get('pts_campeao'), 23),
      pts_surpresa: toInt(formData.get('pts_surpresa'), 15),
      campeao_override: (formData.get('campeao_override') as string | null)?.trim() || null,
      vice_override: (formData.get('vice_override') as string | null)?.trim() || null,
      terceiro_override: (formData.get('terceiro_override') as string | null)?.trim() || null,
      surpresa_override: (formData.get('surpresa_override') as string | null)?.trim() || null,
      knockout_buffer_secs: toInt(formData.get('knockout_buffer_secs'), 300),
      precopa_deadline: dl ? new Date(dl).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) return { ok: false, message: `Erro ao salvar config: ${error.message}` }

  const result = await recomputarTudo()
  revalidatePath('/admin')
  revalidatePath('/ranking')
  return result.ok
    ? { ok: true, message: 'Regras salvas e pontuação recalculada.' }
    : { ok: false, message: result.message }
}

// Salva o bracket real do admin: para cada slot R16+ com participantes definidos,
// cria ou atualiza um registro manual em `partidas` (external_id < 0).
// Não chama recomputarTudo — admin faz isso explicitamente depois.
export async function salvarBracketReal(
  picks: Record<string, string>,
): Promise<{ ok: boolean; message: string }> {
  await assertAdmin()

  const admin = createAdminClient()

  // Re-carrega template e R32 partidas do banco (não confia nos dados do cliente).
  const [{ data: templateRows }, { data: r32Rows }, { data: allKnockout }, { data: aliasRows }, { data: crestRows }] =
    await Promise.all([
      admin.from('bracket_template').select('*'),
      admin.from('partidas').select('slot_key, time_casa, time_fora').is('grupo', null).like('slot_key', 'R32-%'),
      admin.from('partidas').select('id, slot_key, external_id').is('grupo', null).not('slot_key', 'is', null),
      admin.from('team_alias').select('alias, canonical'),
      admin.from('partidas').select('time_casa, time_fora, crest_casa, crest_fora'),
    ])

  const template = (templateRows ?? []) as BracketSlot[]
  const r32Slots: Record<string, { home: string | null; away: string | null }> = {}
  for (const p of (r32Rows ?? []) as { slot_key: string; time_casa: string; time_fora: string }[]) {
    r32Slots[p.slot_key] = { home: p.time_casa, away: p.time_fora }
  }

  // Normaliza nomes (PT/variantes → canônico da API), mesmo padrão de scoring.ts.
  const aliasMap: Record<string, string> = {}
  for (const a of (aliasRows ?? []) as { alias: string; canonical: string }[]) aliasMap[a.alias] = a.canonical
  const canon = (name: string | null | undefined) => (name ? aliasMap[name] ?? name : '')

  // Mapa nome→escudo a partir de QUALQUER partida que o tenha (mesma ideia do
  // setMeta em mata-mata/page.tsx): reaproveita as bandeiras já sincronizadas
  // da API para os jogos criados à mão no bracket.
  const crestByTeam = new Map<string, string>()
  const setCrest = (name: string | null, crest: string | null) => {
    if (!name || !crest) return
    const key = canon(name)
    if (!crestByTeam.has(key)) crestByTeam.set(key, crest)
  }
  for (const p of (crestRows ?? []) as {
    time_casa: string | null
    time_fora: string | null
    crest_casa: string | null
    crest_fora: string | null
  }[]) {
    setCrest(p.time_casa, p.crest_casa)
    setCrest(p.time_fora, p.crest_fora)
  }
  const crestFor = (name: string | null) => crestByTeam.get(canon(name)) ?? null

  const slots = computeBracketSlots(template, r32Slots, picks)

  // Índice dos registros existentes por slot_key.
  const existing = new Map<string, { id: string; external_id: number }>()
  for (const r of (allKnockout ?? []) as { id: string; slot_key: string; external_id: number }[]) {
    if (r.slot_key) existing.set(r.slot_key, { id: r.id, external_id: r.external_id })
  }

  // Menor external_id manual atual (para gerar próximos negativos).
  const { data: minRow } = await admin
    .from('partidas')
    .select('external_id')
    .lt('external_id', 0)
    .order('external_id', { ascending: true })
    .limit(1)
    .maybeSingle()
  let nextNegativeId: number = ((minRow as { external_id: number } | null)?.external_id ?? 0) - 1

  const NON_R32 = ['R16', 'QF', 'SF', 'THIRD', 'FINAL']
  let created = 0
  let updated = 0

  for (const round of NON_R32) {
    for (const s of template.filter((t) => t.round === round)) {
      const part = slots[s.slot_key]
      if (!part?.home || !part?.away) continue

      const agendado = KNOCKOUT_SCHEDULE[s.slot_key]
      const crestCasa = crestFor(part.home)
      const crestFora = crestFor(part.away)

      const cur = existing.get(s.slot_key)
      if (cur) {
        if (cur.external_id > 0) continue // registro da API — não tocar
        // Corrige data placeholder e escudos das linhas manuais já criadas.
        // Só sobrescreve crest quando encontramos um (nunca apaga com null).
        const patch: Record<string, unknown> = {
          time_casa: part.home,
          time_fora: part.away,
          fase: FASE_LABEL[s.round] ?? null,
          updated_at: new Date().toISOString(),
        }
        if (agendado) patch.data_jogo = agendado
        if (crestCasa) patch.crest_casa = crestCasa
        if (crestFora) patch.crest_fora = crestFora
        const { error } = await admin.from('partidas').update(patch).eq('id', cur.id)
        if (error) return { ok: false, message: `Erro ao atualizar ${s.slot_key}: ${error.message}` }
        updated++
      } else {
        const { error } = await admin.from('partidas').insert({
          external_id: nextNegativeId--,
          slot_key: s.slot_key,
          time_casa: part.home,
          time_fora: part.away,
          crest_casa: crestCasa,
          crest_fora: crestFora,
          grupo: null,
          fase: FASE_LABEL[s.round] ?? null,
          status: 'SCHEDULED',
          data_jogo: agendado ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        if (error) return { ok: false, message: `Erro ao criar ${s.slot_key}: ${error.message}` }
        created++
      }
    }
  }

  revalidatePath('/admin/bracket')
  revalidatePath('/mata-mata')
  revalidatePath('/admin')
  return { ok: true, message: `Bracket salvo: ${created} criado(s), ${updated} atualizado(s).` }
}

// Define o placar de um jogo do mata-mata e atualiza o status.
// acao = 'ao_vivo' → IN_PLAY (placar parcial, sem recalcular pontos definitivos)
// acao = 'finalizar' → FINISHED (grava o placar 90' e encerra, SEM recalcular
//   pontos — a pontuação definitiva é rodada à parte em "Recalcular pontuação").
export async function definirPlacar90(formData: FormData) {
  await assertAdmin()

  const partidaId = formData.get('partidaId') as string
  if (!partidaId) throw new Error('Partida inválida')

  const casa = formData.get('placar_casa_90')
  const fora = formData.get('placar_fora_90')
  const slotKey = (formData.get('slot_key') as string | null)?.trim() || null
  const acao = (formData.get('acao') as string) ?? 'finalizar'

  const gols_casa = casa === '' || casa == null ? null : Number(casa)
  const gols_fora = fora === '' || fora == null ? null : Number(fora)

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    placar_casa: gols_casa,
    placar_fora: gols_fora,
    status: acao === 'ao_vivo' ? 'IN_PLAY' : 'FINISHED',
  }

  if (acao === 'finalizar') {
    patch.placar_casa_90 = gols_casa
    patch.placar_fora_90 = gols_fora
  }

  if (slotKey !== null) patch.slot_key = slotKey

  const admin = createAdminClient()
  const { error } = await admin.from('partidas').update(patch).eq('id', partidaId)
  if (error) throw new Error(`Erro ao salvar placar: ${error.message}`)

  if (acao === 'finalizar') {
    // Encerra sem recalcular: a pontuação só muda ao rodar "Recalcular pontuação".
    revalidatePath('/realizadas')
    revalidatePath('/mata-mata')
  }
  revalidatePath('/admin')
}
