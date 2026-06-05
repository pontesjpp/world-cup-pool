import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth'
import { grupoLetra } from '@/lib/bracket'
import { THIRD_PLACE_MATRIX } from '@/lib/thirdPlaceMatrix'
import { PreCopaWizard } from '@/components/precopa/PreCopaWizard'
import type { BracketSlot, PreCopaDraft, Team } from '@/lib/types'
import type { WizardData, WizardGroup } from '@/components/precopa/types'

export const metadata = { title: 'Pré-Copa — Bolão da Galera' }

type GroupPartidaRow = {
  id: string
  grupo: string
  time_casa: string
  time_fora: string
  crest_casa: string | null
  crest_fora: string | null
  data_jogo: string
}

function Vazio({ msg }: { msg: string }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
      <span className="turf-layer" aria-hidden />
      <p className="relative z-10 font-sans text-cream/55">{msg}</p>
    </div>
  )
}

export default async function PreCopaPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const { step } = await searchParams
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) return <Vazio msg="Faça login para preencher sua pré-Copa." />

  const [grpRes, tmplRes, surpRes, aliasRes, cfgRes, palRes, brkRes, finRes, stRes] =
    await Promise.all([
      supabase
        .from('partidas')
        .select('id, grupo, time_casa, time_fora, crest_casa, crest_fora, data_jogo')
        .not('grupo', 'is', null)
        .order('grupo', { ascending: true })
        .order('data_jogo', { ascending: true }),
      supabase.from('bracket_template').select('*'),
      supabase.from('surpresa_elegivel').select('team_name'),
      supabase.from('team_alias').select('alias, canonical'),
      supabase.from('scoring_config').select('precopa_deadline').eq('id', 1).single(),
      supabase
        .from('palpites')
        .select('partida_id, palpite_casa, palpite_fora')
        .eq('user_id', user.id)
        .eq('fase_palpite', 'GRUPO'),
      supabase.from('palpite_bracket').select('slot_key, time').eq('user_id', user.id),
      supabase.from('palpite_final').select('campeao, vice, terceiro, surpresa').eq('user_id', user.id).maybeSingle(),
      supabase.from('precopa_status').select('submitted').eq('user_id', user.id).maybeSingle(),
    ])

  const partidas = (grpRes.data ?? []) as GroupPartidaRow[]
  if (partidas.length === 0) {
    return (
      <div>
        <Header />
        <Vazio msg="A fase de grupos ainda não foi sincronizada pelo administrador. Volte quando a tabela estiver disponível." />
      </div>
    )
  }

  // ── Agrupa por letra ──
  const byLetter = new Map<string, GroupPartidaRow[]>()
  for (const p of partidas) {
    const L = grupoLetra(p.grupo)
    const arr = byLetter.get(L) ?? []
    arr.push(p)
    byLetter.set(L, arr)
  }
  const groups: WizardGroup[] = [...byLetter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, jogos]) => {
      const teamMap = new Map<string, Team>()
      for (const j of jogos) {
        if (!teamMap.has(j.time_casa)) teamMap.set(j.time_casa, { name: j.time_casa, crest: j.crest_casa })
        if (!teamMap.has(j.time_fora)) teamMap.set(j.time_fora, { name: j.time_fora, crest: j.crest_fora })
      }
      return {
        letter,
        teams: [...teamMap.values()],
        matches: jogos.map((j) => ({
          id: j.id,
          home: { name: j.time_casa, crest: j.crest_casa },
          away: { name: j.time_fora, crest: j.crest_fora },
          date: j.data_jogo,
        })),
      }
    })

  // ── Template + matriz oficial dos 3ºs (bundled) ──
  const template = (tmplRes.data ?? []) as BracketSlot[]
  const matrix = THIRD_PLACE_MATRIX

  // ── Surpresa: times do torneio que são elegíveis (canonicaliza via alias) ──
  const aliasMap: Record<string, string> = {}
  for (const a of aliasRes.data ?? []) aliasMap[a.alias as string] = a.canonical as string
  const elegiveis = new Set((surpRes.data ?? []).map((r) => r.team_name as string))
  const allTeams = new Map<string, Team>()
  for (const g of groups) for (const t of g.teams) allTeams.set(t.name, t)
  const canon = (name: string) => aliasMap[name] ?? name
  let surpresaTeams = [...allTeams.values()].filter(
    (t) => elegiveis.has(t.name) || elegiveis.has(canon(t.name)),
  )
  if (surpresaTeams.length === 0) surpresaTeams = [...allTeams.values()]
  surpresaTeams.sort((a, b) => a.name.localeCompare(b.name))

  // ── Rascunho inicial ──
  const scores: PreCopaDraft['scores'] = {}
  for (const p of palRes.data ?? []) {
    scores[p.partida_id as string] = { casa: p.palpite_casa as number, fora: p.palpite_fora as number }
  }
  const bracket: Record<string, string> = {}
  for (const b of brkRes.data ?? []) bracket[b.slot_key as string] = b.time as string
  const fin = finRes.data as { campeao: string | null; vice: string | null; terceiro: string | null; surpresa: string | null } | null

  const initialDraft: PreCopaDraft = {
    scores,
    bracket,
    finais: {
      campeao: fin?.campeao ?? null,
      vice: fin?.vice ?? null,
      terceiro: fin?.terceiro ?? null,
      surpresa: fin?.surpresa ?? null,
    },
  }

  const deadline = (cfgRes.data?.precopa_deadline as string | null) ?? null
  const submitted = !!stRes.data?.submitted
  const frozen = (deadline ? new Date(deadline).getTime() <= Date.now() : false) || submitted

  const data: WizardData = {
    groups,
    template,
    matrix,
    surpresaTeams,
    initialDraft,
    frozen,
    submitted,
    deadline,
  }

  const initialStep = step ?? `grupo-${groups[0]?.letter ?? 'A'}`

  return (
    <div>
      <Header />
      <PreCopaWizard data={data} initialStep={initialStep} />
    </div>
  )
}

function Header() {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-3">
        <span className="h-[2px] w-8 bg-brasil-gold" />
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
          Palpite único
        </span>
      </div>
      <h1 className="font-display text-4xl uppercase leading-[0.85] tracking-tight text-cream md:text-5xl">
        Pré-<span className="text-brasil-gold">Copa</span>
      </h1>
    </div>
  )
}
