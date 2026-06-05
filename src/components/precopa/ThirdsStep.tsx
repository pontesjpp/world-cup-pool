'use client'

import Image from 'next/image'
import { StepNav } from './StepNav'
import type { ThirdRankEntry } from '@/lib/bracket'
import type { Team } from '@/lib/types'

// Ranking ao vivo dos 3ºs colocados de todos os grupos. Os `advanceCount`
// melhores avançam ao mata-mata — uma linha de corte separa quem passa.
// Reordena conforme os placares dos grupos mudam (somente leitura).
export function ThirdsStep({
  ranked,
  advanceCount,
  teamsMeta,
  groupsComplete,
  onPrev,
  onNext,
}: {
  ranked: ThirdRankEntry[]
  advanceCount: number
  teamsMeta: Record<string, Team>
  groupsComplete: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            Repescagem
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-6xl">
          3 <span className="text-brasil-gold">Lugares</span>
        </h1>
        <p className="mt-3 font-sans text-xs text-cream/45">
          Os <span className="text-brasil-gold">{advanceCount} melhores 3ºs colocados</span> avançam
          ao mata-mata. O ranking abaixo vem dos seus placares da fase de grupos.
        </p>
      </div>

      {!groupsComplete && (
        <div className="mb-4 rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-center font-sans text-[11px] uppercase tracking-[0.15em] text-cream/55">
          Preencha todos os grupos para o ranking ficar definitivo
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface/95 shadow-poster backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brasil-gold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brasil-gold" />
            Ranking dos 3ºs
          </span>
          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-cream/35">
            Pts · SG · GP
          </span>
        </div>

        <div className="divide-y divide-white/5">
          {ranked.map((entry, i) => {
            const meta = teamsMeta[entry.row.team]
            const cut = !entry.qualifies && i > 0 && ranked[i - 1].qualifies
            return (
              <div key={entry.group}>
                {cut && (
                  <div className="flex items-center gap-2 bg-void/40 px-4 py-1">
                    <span className="h-px flex-1 bg-flare/30" />
                    <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-flare/70">
                      Linha de corte
                    </span>
                    <span className="h-px flex-1 bg-flare/30" />
                  </div>
                )}
                <div
                  className={`motion-cinema flex items-center gap-3 px-4 py-2.5 ${
                    entry.qualifies ? 'bg-pitch-vivid/10' : 'opacity-55'
                  }`}
                >
                  <span
                    className={`tabular w-5 text-center font-display text-lg ${
                      entry.qualifies ? 'text-pitch-vivid' : 'text-cream/30'
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <span className="flex h-5 w-7 shrink-0 items-center justify-center rounded bg-white/5 font-display text-xs text-cream/55">
                    {entry.group}
                  </span>
                  {meta?.crest ? (
                    <Image
                      src={meta.crest}
                      alt={entry.row.team}
                      width={24}
                      height={24}
                      className="h-5 w-5 shrink-0 object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="h-5 w-5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-display text-sm uppercase tracking-wide text-cream">
                    {entry.row.team}
                    {entry.row.tiebreakByLot && (
                      <span
                        title="Empate — critério final no sorteio"
                        className="ml-1.5 text-[10px] text-cream/40"
                      >
                        ⚖
                      </span>
                    )}
                  </span>
                  <span className="tabular w-8 text-right font-display text-base text-cream">
                    {entry.row.points}
                  </span>
                  <span className="tabular w-9 text-right font-sans text-xs text-cream/45">
                    {entry.row.gd > 0 ? `+${entry.row.gd}` : entry.row.gd}
                  </span>
                  <span className="tabular w-6 text-right font-sans text-xs text-cream/45">
                    {entry.row.gf}
                  </span>
                </div>
              </div>
            )
          })}

          {ranked.length === 0 && (
            <p className="py-8 text-center font-sans text-sm text-cream/40">
              Sem 3ºs colocados ainda — preencha os placares dos grupos.
            </p>
          )}
        </div>
      </div>

      <StepNav onPrev={onPrev} onNext={onNext} prevLabel="← Grupos" nextLabel="Montar chave →" />
    </div>
  )
}

export default ThirdsStep
