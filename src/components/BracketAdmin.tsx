'use client'

import { useState, useTransition } from 'react'
import { TeamPickButton } from './precopa/TeamPickButton'
import { ROUND_LABEL, ROUND_SEQ } from './precopa/BracketView'
import { computeBracketSlots, detectStale, prunePicks } from '@/lib/bracket'
import { salvarBracketReal } from '@/actions/admin'
import type { BracketRound, BracketSlot, Team } from '@/lib/types'
import type { SlotParticipants } from '@/lib/bracket'

export function BracketAdmin({
  template,
  r32Slots,
  initialPicks,
  teamsMeta,
}: {
  template: BracketSlot[]
  r32Slots: Record<string, SlotParticipants>
  initialPicks: Record<string, string>
  teamsMeta: Record<string, Team>
}) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks)
  const [active, setActive] = useState<BracketRound>('R32')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const slots = computeBracketSlots(template, r32Slots, picks)
  const staleSet = detectStale(slots, picks)

  const rounds = ROUND_SEQ.filter((r) => template.some((s) => s.round === r))
  const slotsOfRound = template
    .filter((s) => s.round === active)
    .sort((a, b) => a.match_no - b.match_no)

  const meta = (name: string | null): Team | null =>
    name ? (teamsMeta[name] ?? { name, crest: null }) : null

  const pickedInRound = slotsOfRound.filter((s) => picks[s.slot_key]).length

  function onPick(slotKey: string, team: string) {
    const pruned = prunePicks(template, r32Slots, { ...picks, [slotKey]: team })
    setPicks(pruned)
    setMessage(null)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await salvarBracketReal(picks)
      setMessage({ ok: result.ok, text: result.message })
    })
  }

  return (
    <div className="space-y-4">
      {/* Tabs de rodada */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
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
                  ? 'border-warm-orange bg-warm-orange/15 text-warm-orange'
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

      <p className="font-sans text-xs text-cream/45">
        <strong className="tabular text-warm-orange">{pickedInRound}</strong>/{slotsOfRound.length}{' '}
        confronto(s) definido(s) em {ROUND_LABEL[active]}
        {active === 'THIRD' && ' — perdedores das semis'}
      </p>

      {/* Grade de slots */}
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
                  {s.source_home && s.source_away && active === 'R32'
                    ? ` · ${s.source_home} × ${s.source_away}`
                    : null}
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
                  onClick={() => part.home && onPick(s.slot_key, part.home)}
                />
                <TeamPickButton
                  team={meta(part.away)}
                  selected={!!pick && pick === part.away}
                  dim={!!pick && pick !== part.away}
                  onClick={() => part.away && onPick(s.slot_key, part.away)}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Salvar */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="motion-cinema rounded-xl bg-gradient-to-br from-warm-orange to-[#FFB347] px-6 py-3 font-display uppercase tracking-wide text-void hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
        >
          {isPending ? 'Salvando…' : 'Salvar bracket'}
        </button>
        {message && (
          <p
            className={`font-sans text-sm ${message.ok ? 'text-pitch-vivid' : 'text-warm-orange'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
