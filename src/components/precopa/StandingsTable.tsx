'use client'

import Image from 'next/image'
import type { StandingRow, Team } from '@/lib/types'

// Classificação ao vivo de um grupo. Top-2 (classificados) destacados; 3º com
// marcador de "repescagem" (melhores 3ºs). Reordena conforme placares mudam.
export function StandingsTable({
  rows,
  teamsMeta,
}: {
  rows: StandingRow[]
  teamsMeta: Record<string, Team>
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface/95 shadow-poster backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brasil-gold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brasil-gold" />
          Classificação ao vivo
        </span>
        <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-cream/35">
          Pts · SG · GP
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map((r) => {
          const meta = teamsMeta[r.team]
          const advance = r.position <= 2
          const repescagem = r.position === 3
          return (
            <div
              key={r.team}
              className={`motion-cinema flex items-center gap-3 px-4 py-2.5 ${
                advance ? 'bg-pitch-vivid/10' : repescagem ? 'bg-brasil-gold/[0.06]' : ''
              }`}
            >
              <span
                className={`tabular w-5 text-center font-display text-lg ${
                  advance ? 'text-pitch-vivid' : repescagem ? 'text-brasil-gold' : 'text-cream/30'
                }`}
              >
                {r.position}
              </span>
              {meta?.crest ? (
                <Image
                  src={meta.crest}
                  alt={r.team}
                  width={24}
                  height={24}
                  className="h-5 w-5 shrink-0 object-contain"
                  unoptimized
                />
              ) : (
                <span className="h-5 w-5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate font-display text-sm uppercase tracking-wide text-cream">
                {r.team}
                {r.tiebreakByLot && (
                  <span
                    title="Empate — critério final no sorteio"
                    className="ml-1.5 text-[10px] text-cream/40"
                  >
                    ⚖
                  </span>
                )}
              </span>
              <span className="tabular w-8 text-right font-display text-base text-cream">
                {r.points}
              </span>
              <span className="tabular w-9 text-right font-sans text-xs text-cream/45">
                {r.gd > 0 ? `+${r.gd}` : r.gd}
              </span>
              <span className="tabular w-6 text-right font-sans text-xs text-cream/45">{r.gf}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default StandingsTable
