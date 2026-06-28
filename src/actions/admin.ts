'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recomputarTudo } from '@/actions/scoring'

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

  const rows = matches
    .filter((m) => m.homeTeam?.name && m.awayTeam?.name)
    .map((m) => {
      const slotByHome = teamToSlot.get((m.homeTeam.name ?? '').toLowerCase())
      const slotByAway = teamToSlot.get((m.awayTeam.name ?? '').toLowerCase())
      return {
        external_id: m.id,
        time_casa: m.homeTeam.name as string,
        time_fora: m.awayTeam.name as string,
        crest_casa: m.homeTeam.crest ?? null,
        crest_fora: m.awayTeam.crest ?? null,
        data_jogo: m.utcDate,
        status: mapStatus(m.status),
        placar_casa: m.score?.fullTime?.home ?? null,
        placar_fora: m.score?.fullTime?.away ?? null,
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
export async function atualizarConfig(formData: FormData) {
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
      knockout_buffer_secs: toInt(formData.get('knockout_buffer_secs'), 300),
      precopa_deadline: dl ? new Date(dl).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) throw new Error(`Erro ao salvar config: ${error.message}`)

  await recomputarTudo()
  revalidatePath('/admin')
  revalidatePath('/ranking')
}

// Define o placar regulamentar (90') de um jogo do mata-mata e, opcionalmente,
// o slot do chaveamento ao qual ele corresponde. Recalcula a pontuação.
export async function definirPlacar90(formData: FormData) {
  await assertAdmin()

  const partidaId = formData.get('partidaId') as string
  if (!partidaId) throw new Error('Partida inválida')
  const casa = formData.get('placar_casa_90')
  const fora = formData.get('placar_fora_90')
  const slotKey = (formData.get('slot_key') as string | null)?.trim() || null

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  patch.placar_casa_90 = casa === '' || casa == null ? null : Number(casa)
  patch.placar_fora_90 = fora === '' || fora == null ? null : Number(fora)
  if (slotKey !== null) patch.slot_key = slotKey

  const admin = createAdminClient()
  const { error } = await admin.from('partidas').update(patch).eq('id', partidaId)
  if (error) throw new Error(`Erro ao salvar placar 90': ${error.message}`)

  await recomputarTudo()
  revalidatePath('/admin')
  revalidatePath('/ranking')
  revalidatePath('/realizadas')
  revalidatePath('/mata-mata')
}
