import { createClient } from '@/lib/supabase/server'
import { selectAll } from '@/lib/supabase/selectAll'
import { getCachedUser } from '@/lib/auth'
import { computeGroupStandings } from '@/lib/standings'
import { grupoLetra } from '@/lib/bracket'
import { ClassificacaoViewer, type ClassPlayer } from '@/components/classificacao/ClassificacaoViewer'

export const metadata = { title: 'Classificação dos Grupos — Bolão da Galera' }

type ClassDbRow = {
  user_id: string
  grupo: string
  posicao: number
  time: string
}

type GroupPartida = {
  time_casa: string
  time_fora: string
  placar_casa: number | null
  placar_fora: number | null
  grupo: string | null
}

function Header() {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center gap-3">
        <span className="h-[2px] w-8 bg-brasil-gold" />
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
          Fase de Grupos
        </span>
      </div>
      <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-7xl">
        Classi<span className="text-brasil-gold">ficação</span>
      </h1>
    </div>
  )
}

export default async function ClassificacaoPage() {
  const supabase = await createClient()
  const user = await getCachedUser()

  if (!user) {
    return (
      <div>
        <Header />
        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
          <p className="relative z-10 font-sans text-cream/55">
            Faça login para ver as classificações.
          </p>
        </div>
      </div>
    )
  }

  const [classRows, partidasRes, profRes, stRes, cfgRes] = await Promise.all([
    selectAll<ClassDbRow>((from, to) =>
      supabase
        .from('palpite_classificacao')
        .select('user_id, grupo, posicao, time')
        .order('user_id')
        .order('grupo')
        .order('posicao')
        .range(from, to),
    ),
    supabase
      .from('partidas')
      .select('time_casa, time_fora, placar_casa, placar_fora, grupo')
      .not('grupo', 'is', null),
    supabase.from('profiles').select('id, nome, avatar_url'),
    supabase.from('precopa_status').select('user_id, submitted'),
    supabase
      .from('scoring_config')
      .select('pts_posicao, pts_grupo_completo')
      .eq('id', 1)
      .maybeSingle(),
  ])

  const pts_posicao = (cfgRes.data?.pts_posicao as number | null) ?? 1
  const pts_grupo_completo = (cfgRes.data?.pts_grupo_completo as number | null) ?? 3

  // Compute actual standings from real match results
  const groupPartidas = (partidasRes.data ?? []) as GroupPartida[]

  const matchesByLetter = new Map<string, GroupPartida[]>()
  for (const p of groupPartidas) {
    if (!p.grupo) continue
    const letra = grupoLetra(p.grupo)
    const arr = matchesByLetter.get(letra) ?? []
    arr.push(p)
    matchesByLetter.set(letra, arr)
  }

  const actualStandingsByLetter: Record<string, { position: number; team: string }[]> = {}
  const groupFinished: Record<string, boolean> = {}

  for (const [letra, matches] of matchesByLetter) {
    const teams = new Set<string>()
    for (const m of matches) {
      teams.add(m.time_casa)
      teams.add(m.time_fora)
    }

    const finished = matches.length > 0 && matches.every(
      (m) => m.placar_casa != null && m.placar_fora != null,
    )
    groupFinished[letra] = finished

    const standings = computeGroupStandings(
      [...teams],
      matches.map((m) => ({
        home: m.time_casa,
        away: m.time_fora,
        homeGoals: m.placar_casa,
        awayGoals: m.placar_fora,
      })),
    )
    actualStandingsByLetter[letra] = standings.map((r) => ({
      position: r.position,
      team: r.team,
    }))
  }

  // Collect all group letters from predictions
  const allLetters = new Set<string>()
  for (const row of classRows) allLetters.add(grupoLetra(row.grupo))
  const sortedLetters = [...allLetters].sort()

  const classByUser = new Map<string, ClassDbRow[]>()
  for (const c of classRows) {
    const arr = classByUser.get(c.user_id) ?? []
    arr.push(c)
    classByUser.set(c.user_id, arr)
  }

  const profById = new Map<string, { nome: string; avatar_url: string | null }>()
  for (const p of (profRes.data ?? []) as { id: string; nome: string; avatar_url: string | null }[]) {
    profById.set(p.id, { nome: p.nome, avatar_url: p.avatar_url })
  }

  const submittedByUser = new Map<string, boolean>()
  for (const s of (stRes.data ?? []) as { user_id: string; submitted: boolean }[]) {
    submittedByUser.set(s.user_id, s.submitted)
  }

  const players: ClassPlayer[] = [...classByUser.keys()].map((uid) => {
    const rows = classByUser.get(uid) ?? []
    const prof = profById.get(uid)

    const rowsByLetter = new Map<string, ClassDbRow[]>()
    for (const r of rows) {
      const letra = grupoLetra(r.grupo)
      const arr = rowsByLetter.get(letra) ?? []
      arr.push(r)
      rowsByLetter.set(letra, arr)
    }

    let totalPts = 0
    const grupos = sortedLetters.map((letra) => {
      const userRows = rowsByLetter.get(letra) ?? []
      const actual = actualStandingsByLetter[letra] ?? []
      const actualByPos = new Map(actual.map((r) => [r.position, r.team]))
      const finished = groupFinished[letra] ?? false

      let ptsGanhos = 0
      let acertos = 0
      const predictions = userRows
        .sort((a, b) => a.posicao - b.posicao)
        .map((r) => {
          const correct = finished ? actualByPos.get(r.posicao) === r.time : null
          if (correct) {
            ptsGanhos += pts_posicao
            acertos++
          }
          return { position: r.posicao, team: r.time, correct }
        })

      const grupoCompleto = finished && acertos === 4
      if (grupoCompleto) ptsGanhos += pts_grupo_completo
      totalPts += ptsGanhos

      return { letra, finished, actualStandings: actual, predictions, ptsGanhos, grupoCompleto }
    })

    return {
      user_id: uid,
      nome: prof?.nome ?? 'Participante',
      avatar_url: prof?.avatar_url ?? null,
      submitted: submittedByUser.get(uid) ?? false,
      grupos,
      totalPts,
    }
  })

  return (
    <div>
      <Header />
      <ClassificacaoViewer
        meId={user.id}
        players={players}
        pts_posicao={pts_posicao}
        pts_grupo_completo={pts_grupo_completo}
      />
    </div>
  )
}
