import { createClient } from '@/lib/supabase/server'
import { selectAll } from '@/lib/supabase/selectAll'
import { getCachedUser } from '@/lib/auth'
import { BracketViewer, type MataMataPlayer } from '@/components/matamata/BracketViewer'
import type { ClassRow } from '@/lib/matamata'
import type { SlotParticipants } from '@/lib/bracket'
import type { BracketSlot, Team } from '@/lib/types'

export const metadata = { title: 'Mata-mata — Bolão da Galera' }

type BracketPickRow = { user_id: string; slot_key: string; time: string; pontos_obtidos: number; acertou: boolean }
type ClassDbRow = { user_id: string; grupo: string; posicao: number; time: string; pontos_grupo: number | null; saldo: number | null; gols_pro: number | null }
type FinalRow = { user_id: string; campeao: string | null; vice: string | null; terceiro: string | null; surpresa: string | null }
type CrestRow = { time_casa: string; time_fora: string; crest_casa: string | null; crest_fora: string | null }
type SlotRow  = { time_casa: string; time_fora: string; slot_key: string }

function Vazio({ msg }: { msg: string }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
      <span className="turf-layer" aria-hidden />
      <p className="relative z-10 font-sans text-cream/55">{msg}</p>
    </div>
  )
}

function Header() {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center gap-3">
        <span className="h-[2px] w-8 bg-brasil-gold" />
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
          A Reta Final
        </span>
      </div>
      <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-7xl">
        Mata-<span className="text-brasil-gold">mata</span>
      </h1>
    </div>
  )
}

export default async function MataMata() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) {
    return (
      <div>
        <Header />
        <Vazio msg="Faça login para ver os brackets do mata-mata." />
      </div>
    )
  }

  const [tmplRes, brkRows, classRows, finRes, stRes, profRes, partCrests, partSlots, cfgRes] = await Promise.all([
    supabase.from('bracket_template').select('*'),
    // Paginado: palpite_bracket (~32/usuário) e palpite_classificacao (48/usuário)
    // estouram o cap de 1000 linhas do PostgREST e fariam sumir os últimos usuários.
    selectAll<BracketPickRow>((from, to) =>
      supabase
        .from('palpite_bracket')
        .select('user_id, slot_key, time, pontos_obtidos, acertou')
        .order('user_id')
        .order('slot_key')
        .range(from, to),
    ),
    selectAll<ClassDbRow>((from, to) =>
      supabase
        .from('palpite_classificacao')
        // pontos_grupo/saldo/gols_pro são necessárias pra rankear os 3ºs na semeadura do R32.
        .select('user_id, grupo, posicao, time, pontos_grupo, saldo, gols_pro')
        .order('user_id')
        .order('grupo')
        .order('posicao')
        .range(from, to),
    ),
    supabase.from('palpite_final').select('user_id, campeao, vice, terceiro, surpresa'),
    supabase.from('precopa_status').select('user_id, submitted'),
    supabase.from('profiles').select('id, nome, avatar_url'),
    // Escudos: todas as partidas (times de grupo sem slot_key também precisam de crest).
    supabase.from('partidas').select('time_casa, time_fora, crest_casa, crest_fora'),
    // Slots reais do mata-mata: só jogos sem grupo (knockout) com slot_key definido.
    supabase.from('partidas').select('time_casa, time_fora, slot_key').not('slot_key', 'is', null).is('grupo', null),
    supabase.from('scoring_config').select('precopa_deadline').eq('id', 1).maybeSingle(),
  ])

  const template = (tmplRes.data ?? []) as BracketSlot[]

  // ── Metadados de times (escudos) e confrontos reais por slot ──
  const teamsMeta: Record<string, Team> = {}
  const actualSlots: Record<string, SlotParticipants> = {}
  // Preenche o escudo a partir de QUALQUER partida que o tenha — uma linha sem
  // crest (ex.: slot do R32 inserido à mão) não pode apagar um escudo já achado.
  const setMeta = (name: string, crest: string | null) => {
    const cur = teamsMeta[name]
    if (!cur) teamsMeta[name] = { name, crest }
    else if (!cur.crest && crest) cur.crest = crest
  }
  for (const p of (partCrests.data ?? []) as CrestRow[]) {
    setMeta(p.time_casa, p.crest_casa)
    setMeta(p.time_fora, p.crest_fora)
  }
  for (const p of (partSlots.data ?? []) as SlotRow[]) {
    actualSlots[p.slot_key] = { home: p.time_casa, away: p.time_fora }
  }

  // ── Agrupa por usuário ──
  const picksByUser = new Map<string, Record<string, string>>()
  const pontosByUser = new Map<string, Record<string, number>>()
  const totalByUser = new Map<string, number>()
  for (const b of brkRows) {
    const pk = picksByUser.get(b.user_id) ?? {}
    pk[b.slot_key] = b.time
    picksByUser.set(b.user_id, pk)
    const pts = pontosByUser.get(b.user_id) ?? {}
    pts[b.slot_key] = b.pontos_obtidos
    pontosByUser.set(b.user_id, pts)
    totalByUser.set(b.user_id, (totalByUser.get(b.user_id) ?? 0) + (b.pontos_obtidos ?? 0))
  }

  const classByUser = new Map<string, ClassRow[]>()
  for (const c of classRows) {
    const arr = classByUser.get(c.user_id) ?? []
    arr.push({
      grupo: c.grupo,
      posicao: c.posicao,
      time: c.time,
      points: c.pontos_grupo ?? 0,
      gd: c.saldo ?? 0,
      gf: c.gols_pro ?? 0,
    })
    classByUser.set(c.user_id, arr)
  }

  const finByUser = new Map<string, FinalRow>()
  for (const f of (finRes.data ?? []) as FinalRow[]) finByUser.set(f.user_id, f)

  const submittedByUser = new Map<string, boolean>()
  for (const s of (stRes.data ?? []) as { user_id: string; submitted: boolean }[]) {
    submittedByUser.set(s.user_id, s.submitted)
  }

  const profById = new Map<string, { nome: string; avatar_url: string | null }>()
  for (const p of (profRes.data ?? []) as { id: string; nome: string; avatar_url: string | null }[]) {
    profById.set(p.id, { nome: p.nome, avatar_url: p.avatar_url })
  }

  // Participantes com bracket disponível (RLS já limita: só o próprio antes do prazo).
  const players: MataMataPlayer[] = [...picksByUser.keys()].map((uid) => {
    const prof = profById.get(uid)
    const fin = finByUser.get(uid)
    return {
      user_id: uid,
      nome: prof?.nome ?? 'Participante',
      avatar_url: prof?.avatar_url ?? null,
      submitted: submittedByUser.get(uid) ?? false,
      picks: picksByUser.get(uid) ?? {},
      classificacao: classByUser.get(uid) ?? [],
      finais: {
        campeao: fin?.campeao ?? null,
        vice: fin?.vice ?? null,
        terceiro: fin?.terceiro ?? null,
        surpresa: fin?.surpresa ?? null,
      },
      pontosBySlot: pontosByUser.get(uid) ?? {},
      totalPts: totalByUser.get(uid) ?? 0,
    }
  })

  const deadline = (cfgRes.data?.precopa_deadline as string | null) ?? null
  const fechada = deadline ? new Date(deadline).getTime() <= Date.now() : false
  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : null

  return (
    <div>
      <Header />
      {template.length === 0 ? (
        <Vazio msg="O chaveamento ainda não foi sincronizado pelo administrador." />
      ) : (
        <BracketViewer
          meId={user.id}
          players={players}
          template={template}
          teamsMeta={teamsMeta}
          actualSlots={actualSlots}
          fechada={fechada}
          deadlineLabel={deadlineLabel}
        />
      )}
    </div>
  )
}
