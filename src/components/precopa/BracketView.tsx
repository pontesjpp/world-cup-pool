'use client'

import { useState } from 'react'
import { TeamPickButton } from './TeamPickButton'
import type { BracketRound, BracketSlot, Team } from '@/lib/types'
import type { SlotParticipants } from '@/lib/bracket'

const ROUND_LABEL: Record<BracketRound, string> = {
  R32: '2ª Fase',
  R16: 'Oitavas',
  QF: 'Quartas',
  SF: 'Semis',
  THIRD: '3º lugar',
  FINAL: 'Final',
}
const ROUND_SEQ: BracketRound[] = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']

export function BracketView({
  template,
  slots,
  picks,
  teamsMeta,
  onPick,
  staleSet,
  disabled,
}: {
  template: BracketSlot[]
  slots: Record<string, SlotParticipants>
  picks: Record<string, string>
  teamsMeta: Record<string, Team>
  onPick: (slotKey: string, team: string) => void
  staleSet: Set<string>
  disabled?: boolean
}) {
  const rounds = ROUND_SEQ.filter((r) => template.some((s) => s.round === r))
  const [active, setActive] = useState<BracketRound>(rounds[0] ?? 'R32')

  const slotsOfRound = template
    .filter((s) => s.round === active)
    .sort((a, b) => a.match_no - b.match_no)

  const meta = (name: string | null): Team | null =>
    name ? (teamsMeta[name] ?? { name, crest: null }) : null

  const pickedInRound = slotsOfRound.filter((s) => picks[s.slot_key]).length

  return (
    <div>
      {/* Tabs de rodada */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {rounds.map((r) => {
          const done = template
            .filter((s) => s.round === r)
            .every((s) => picks[s.slot_key])
          return (
            <button
              key={r}
              type="button"
              onClick={() => setActive(r)}
              className={`motion-cinema shrink-0 rounded-full border px-3.5 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] ${
                active === r
                  ? 'border-brasil-gold bg-brasil-gold/15 text-brasil-gold'
                  : done
                    ? 'border-pitch-vivid/40 text-pitch-vivid'
                    : 'border-white/10 text-cream/45 hover:text-cream'
              }`}
            >
              {ROUND_LABEL[r]}
            </button>
          )
        })}
      </div>

      <p className="mb-4 font-sans text-xs text-cream/45">
        <strong className="tabular text-brasil-gold">{pickedInRound}</strong>/{slotsOfRound.length}{' '}
        confronto(s) definido(s) em {ROUND_LABEL[active]}
        {active === 'THIRD' && ' — perdedores das semis'}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {slotsOfRound.map((s) => {
          const part = slots[s.slot_key] ?? { home: null, away: null }
          const pick = picks[s.slot_key]
          const stale = staleSet.has(s.slot_key)
          return (
            <div
              key={s.slot_key}
              className={`rounded-2xl border p-2.5 ${
                stale ? 'border-warm-orange/60 bg-warm-orange/[0.06]' : 'border-white/10 bg-surface'
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-cream/35">
                  {ROUND_LABEL[s.round]} · {s.match_no}
                </span>
                {stale && (
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.15em] text-warm-orange">
                    revise
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <TeamPickButton
                  team={meta(part.home)}
                  selected={!!pick && pick === part.home}
                  dim={!!pick && pick !== part.home}
                  disabled={disabled}
                  onClick={() => part.home && onPick(s.slot_key, part.home)}
                />
                <TeamPickButton
                  team={meta(part.away)}
                  selected={!!pick && pick === part.away}
                  dim={!!pick && pick !== part.away}
                  disabled={disabled}
                  onClick={() => part.away && onPick(s.slot_key, part.away)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default BracketView
