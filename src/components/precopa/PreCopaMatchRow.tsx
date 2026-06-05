'use client'

import { ScoreInputs } from '@/components/ScoreInputs'
import { TeamSide } from '@/components/TeamSide'
import type { Team } from '@/lib/types'

// Linha de palpite de placar (fase de grupos) — controlada, sem form/CTA.
export function PreCopaMatchRow({
  home,
  away,
  casa,
  fora,
  onChange,
  disabled,
  data,
}: {
  home: Team
  away: Team
  casa: number | null
  fora: number | null
  onChange: (casa: number | null, fora: number | null) => void
  disabled?: boolean
  data?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface p-4 md:p-5">
      <span className="turf-layer" aria-hidden />
      <div className="relative z-10">
        {data && (
          <p className="mb-3 text-center font-sans text-[10px] uppercase tracking-[0.2em] text-cream/40">
            {data}
          </p>
        )}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">
          <TeamSide nome={home.name} crest={home.crest} align="right" size="sm" />
          <div className="justify-self-center">
            <ScoreInputs size="md" casa={casa} fora={fora} onChange={onChange} disabled={disabled} />
          </div>
          <TeamSide nome={away.name} crest={away.crest} align="left" size="sm" />
        </div>
      </div>
    </div>
  )
}

export default PreCopaMatchRow
