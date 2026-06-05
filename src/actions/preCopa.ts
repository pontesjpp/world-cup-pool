'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { computeGroupStandings } from '@/lib/standings'
import { grupoLetra } from '@/lib/bracket'
import type { GroupMatchScore, PreCopaDraft } from '@/lib/types'

export type PreCopaResult = { ok: boolean; message: string }

type GroupPartida = { id: string; grupo: string; time_casa: string; time_fora: string }

// Persiste o rascunho (placares de grupo, bracket, finais). A RLS rejeita
// qualquer escrita após o precopa_deadline — devolvemos mensagem amigável.
async function persistDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  draft: PreCopaDraft,
): Promise<string | null> {
  const now = new Date().toISOString()

  // 1) Placares de grupo → palpites (só pares completos; coluna é NOT NULL).
  const scoreRows = Object.entries(draft.scores ?? {})
    .filter(([, v]) => v && v.casa != null && v.fora != null)
    .map(([partidaId, v]) => ({
      user_id: userId,
      partida_id: partidaId,
      palpite_casa: v.casa as number,
      palpite_fora: v.fora as number,
      fase_palpite: 'GRUPO',
      updated_at: now,
    }))
  if (scoreRows.length) {
    const { error } = await supabase
      .from('palpites')
      .upsert(scoreRows, { onConflict: 'user_id,partida_id' })
    if (error) return 'Não foi possível salvar os placares — o prazo da pré-Copa fechou?'
  }

  // 2) Bracket → substitui todos os picks do usuário.
  {
    const { error: delErr } = await supabase.from('palpite_bracket').delete().eq('user_id', userId)
    if (delErr) return 'Não foi possível salvar o chaveamento — prazo encerrado?'
    const rows = Object.entries(draft.bracket ?? {})
      .filter(([, time]) => !!time)
      .map(([slot_key, time]) => ({ user_id: userId, slot_key, time }))
    if (rows.length) {
      const { error } = await supabase.from('palpite_bracket').insert(rows)
      if (error) return 'Não foi possível salvar o chaveamento — prazo encerrado?'
    }
  }

  // 3) Finais (campeão/vice/3º/surpresa).
  {
    const { error } = await supabase.from('palpite_final').upsert(
      {
        user_id: userId,
        campeao: draft.finais?.campeao ?? null,
        vice: draft.finais?.vice ?? null,
        terceiro: draft.finais?.terceiro ?? null,
        surpresa: draft.finais?.surpresa ?? null,
      },
      { onConflict: 'user_id' },
    )
    if (error) return 'Não foi possível salvar os palpites finais — prazo encerrado?'
  }

  // 4) Toca o status (mantém updated_at).
  await supabase
    .from('precopa_status')
    .upsert({ user_id: userId, updated_at: now }, { onConflict: 'user_id' })

  return null
}

// Autosave do rascunho. Chamado com debounce pela wizard.
export async function salvarRascunhoPreCopa(draft: PreCopaDraft): Promise<PreCopaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sessão expirada. Faça login novamente.' }

  const err = await persistDraft(supabase, user.id, draft)
  if (err) return { ok: false, message: err }
  return { ok: true, message: 'Salvo' }
}

// Deriva e grava a classificação canônica de todos os grupos a partir dos
// placares palpitados, aplicando os critérios FIFA.
async function gravarClassificacao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  partidas: GroupPartida[],
  scores: PreCopaDraft['scores'],
): Promise<string | null> {
  const byGroup = new Map<string, GroupPartida[]>()
  for (const p of partidas) {
    const arr = byGroup.get(p.grupo) ?? []
    arr.push(p)
    byGroup.set(p.grupo, arr)
  }

  const rows: {
    user_id: string
    grupo: string
    posicao: number
    time: string
    pontos_grupo: number
    saldo: number
    gols_pro: number
  }[] = []

  for (const [grupo, jogos] of byGroup) {
    const teams = Array.from(new Set(jogos.flatMap((j) => [j.time_casa, j.time_fora])))
    const matches: GroupMatchScore[] = jogos.map((j) => {
      const s = scores[j.id]
      return {
        home: j.time_casa,
        away: j.time_fora,
        homeGoals: s?.casa ?? null,
        awayGoals: s?.fora ?? null,
      }
    })
    const standings = computeGroupStandings(teams, matches)
    for (const st of standings) {
      rows.push({
        user_id: userId,
        grupo,
        posicao: st.position,
        time: st.team,
        pontos_grupo: st.points,
        saldo: st.gd,
        gols_pro: st.gf,
      })
    }
  }

  await supabase.from('palpite_classificacao').delete().eq('user_id', userId)
  if (rows.length) {
    const { error } = await supabase.from('palpite_classificacao').insert(rows)
    if (error) return 'Falha ao gravar a classificação derivada.'
  }
  return null
}

// Envio final: valida completude, congela classificação e marca submitted.
export async function enviarPreCopa(draft: PreCopaDraft): Promise<PreCopaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sessão expirada. Faça login novamente.' }

  // Carrega jogos de grupo e os slots do template para validar completude.
  const [grpRes, tmplRes] = await Promise.all([
    supabase
      .from('partidas')
      .select('id, grupo, time_casa, time_fora')
      .not('grupo', 'is', null),
    supabase.from('bracket_template').select('slot_key'),
  ])

  const partidas = (grpRes.data ?? []) as GroupPartida[]
  const slots = (tmplRes.data ?? []).map((r) => r.slot_key as string)

  if (partidas.length === 0) {
    return { ok: false, message: 'A fase de grupos ainda não foi sincronizada pelo admin.' }
  }

  // 1) Todos os placares de grupo preenchidos?
  const faltamPlacares = partidas.filter((p) => {
    const s = draft.scores?.[p.id]
    return !s || s.casa == null || s.fora == null
  })
  if (faltamPlacares.length > 0) {
    return { ok: false, message: `Faltam ${faltamPlacares.length} placar(es) da fase de grupos.` }
  }

  // 2) Chaveamento completo?
  const faltamSlots = slots.filter((k) => !draft.bracket?.[k])
  if (faltamSlots.length > 0) {
    return { ok: false, message: `Complete o chaveamento — faltam ${faltamSlots.length} confronto(s).` }
  }

  // 3) Finais completas?
  const { campeao, vice, terceiro, surpresa } = draft.finais ?? {}
  if (!campeao || !vice || !terceiro || !surpresa) {
    return { ok: false, message: 'Defina campeão, vice, 3º lugar e seleção surpresa.' }
  }

  // Persiste o rascunho final.
  const errPersist = await persistDraft(supabase, user.id, draft)
  if (errPersist) return { ok: false, message: errPersist }

  // Congela a classificação derivada.
  const errClass = await gravarClassificacao(supabase, user.id, partidas, draft.scores)
  if (errClass) return { ok: false, message: errClass }

  // Marca como enviado.
  const { error } = await supabase.from('precopa_status').upsert(
    {
      user_id: user.id,
      submitted: true,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) return { ok: false, message: 'Falha ao registrar o envio. Tente novamente.' }

  revalidatePath('/')
  revalidatePath('/pre-copa')
  return { ok: true, message: 'Pré-Copa enviada! Agora é torcer. 🏆' }
}

// Reabre a pré-Copa para edição. A RLS de precopa_status já rejeita a escrita
// após o prazo; o check explícito existe só para uma mensagem amigável.
export async function reabrirPreCopa(): Promise<PreCopaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sessão expirada. Faça login novamente.' }

  const { data: cfg } = await supabase
    .from('scoring_config')
    .select('precopa_deadline')
    .eq('id', 1)
    .single()
  const deadline = cfg?.precopa_deadline as string | null
  if (deadline && new Date(deadline).getTime() <= Date.now()) {
    return { ok: false, message: 'O prazo da pré-Copa já fechou — não dá mais para editar.' }
  }

  const { error } = await supabase.from('precopa_status').upsert(
    {
      user_id: user.id,
      submitted: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) return { ok: false, message: 'Falha ao reabrir os palpites. Tente novamente.' }

  revalidatePath('/')
  revalidatePath('/pre-copa')
  return { ok: true, message: 'Palpites reabertos para edição.' }
}
