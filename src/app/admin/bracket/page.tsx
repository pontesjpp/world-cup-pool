import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BracketAdmin } from '@/components/BracketAdmin'
import type { BracketSlot } from '@/lib/types'
import type { Team } from '@/lib/types'

type KnockoutPartida = {
  slot_key: string | null
  time_casa: string
  time_fora: string
  crest_casa: string | null
  crest_fora: string | null
  placar_casa_90: number | null
  placar_fora_90: number | null
  status: string
}

export default async function AdminBracketPage() {
  const profile = await getCurrentProfile()
  if (!profile?.is_admin) redirect('/')

  const supabase = await createClient()

  const [{ data: templateRows }, { data: knockoutRows }] = await Promise.all([
    supabase
      .from('bracket_template')
      .select('slot_key, round, match_no, feeds_from_home, feeds_from_away, source_home, source_away, points_per_slot')
      .order('match_no'),
    supabase
      .from('partidas')
      .select('slot_key, time_casa, time_fora, crest_casa, crest_fora, placar_casa_90, placar_fora_90, status')
      .is('grupo', null)
      .not('slot_key', 'is', null),
  ])

  const template = (templateRows ?? []) as BracketSlot[]
  const partidas = (knockoutRows ?? []) as KnockoutPartida[]

  // R32 participants from real partidas.
  const r32Slots: Record<string, { home: string | null; away: string | null }> = {}
  for (const p of partidas) {
    if (p.slot_key?.startsWith('R32')) {
      r32Slots[p.slot_key] = { home: p.time_casa, away: p.time_fora }
    }
  }

  const partidaBySlot = new Map<string, KnockoutPartida>()
  for (const p of partidas) {
    if (p.slot_key) partidaBySlot.set(p.slot_key, p)
  }
  const templateBySlot = new Map<string, BracketSlot>()
  for (const s of template) {
    templateBySlot.set(s.slot_key, s)
  }

  const adminPicks: Record<string, string> = {}

  // Step 1: auto-detect from FINISHED matches with decisive 90' result.
  for (const p of partidas) {
    if (!p.slot_key) continue
    if (p.status === 'FINISHED' && p.placar_casa_90 != null && p.placar_fora_90 != null) {
      if (p.placar_casa_90 !== p.placar_fora_90) {
        adminPicks[p.slot_key] = p.placar_casa_90 > p.placar_fora_90 ? p.time_casa : p.time_fora
      }
    }
  }

  // Step 2: reconstruct picks from existing R16+ partidas.
  // For R16/QF/SF/FINAL: participants are winners of upstream slots.
  // For THIRD: participants are losers of the SF slots.
  for (const round of ['R16', 'QF', 'SF', 'FINAL', 'THIRD'] as const) {
    for (const s of template.filter((t) => t.round === round)) {
      const p = partidaBySlot.get(s.slot_key)
      if (!p) continue

      if (round === 'THIRD') {
        // time_casa = loser of feeds_from_home; time_fora = loser of feeds_from_away.
        // Infer the winner (the pick) from the SF partida + the loser we know.
        if (s.feeds_from_home) {
          const sf = partidaBySlot.get(s.feeds_from_home)
          if (sf) {
            // loser is p.time_casa; winner = the other team in SF
            const winner = sf.time_casa === p.time_casa ? sf.time_fora : sf.time_casa
            if (winner) adminPicks[s.feeds_from_home] = winner
          }
        }
        if (s.feeds_from_away) {
          const sf = partidaBySlot.get(s.feeds_from_away)
          if (sf) {
            const winner = sf.time_casa === p.time_fora ? sf.time_fora : sf.time_casa
            if (winner) adminPicks[s.feeds_from_away] = winner
          }
        }
      } else {
        if (s.feeds_from_home && p.time_casa) adminPicks[s.feeds_from_home] = p.time_casa
        if (s.feeds_from_away && p.time_fora) adminPicks[s.feeds_from_away] = p.time_fora
      }
    }
  }

  // Teams metadata (crests) from all knockout partidas.
  const teamsMeta: Record<string, Team> = {}
  for (const p of partidas) {
    if (p.time_casa) teamsMeta[p.time_casa] = { name: p.time_casa, crest: p.crest_casa ?? null }
    if (p.time_fora) teamsMeta[p.time_fora] = { name: p.time_fora, crest: p.crest_fora ?? null }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-1.5 font-sans text-xs text-cream/45 hover:text-cream"
        >
          <ArrowLeft size={12} />
          Administração
        </Link>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-6xl">
          Bracket <span className="text-warm-orange">Real</span>
        </h1>
        <p className="mt-2 font-sans text-sm text-cream/50">
          Selecione quem avança em cada confronto. Empates nos 90&apos; (pênaltis) precisam ser
          definidos manualmente. Clique <strong className="text-cream/70">Salvar bracket</strong> e
          depois <strong className="text-cream/70">Recalcular pontuação</strong> em{' '}
          <Link href="/admin" className="text-brasil-gold hover:underline">
            /admin
          </Link>
          .
        </p>
      </div>

      <BracketAdmin
        template={template}
        r32Slots={r32Slots}
        initialPicks={adminPicks}
        teamsMeta={teamsMeta}
      />
    </div>
  )
}
