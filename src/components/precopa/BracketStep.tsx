'use client'

import { BracketView } from './BracketView'
import { StepNav } from './StepNav'
import type { BracketSlot, Team } from '@/lib/types'
import type { SlotParticipants } from '@/lib/bracket'

export function BracketStep({
  template,
  slots,
  picks,
  teamsMeta,
  onPick,
  staleSet,
  matrixHit,
  disabled,
  onPrev,
  onNext,
}: {
  template: BracketSlot[]
  slots: Record<string, SlotParticipants>
  picks: Record<string, string>
  teamsMeta: Record<string, Team>
  onPick: (slotKey: string, team: string) => void
  staleSet: Set<string>
  matrixHit: boolean
  disabled?: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const total = template.length
  const done = template.filter((s) => picks[s.slot_key]).length

  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            Mata-mata
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-6xl">
          O <span className="text-brasil-gold">Chaveamento</span>
        </h1>
        <p className="mt-3 max-w-xl font-sans text-sm text-cream/55">
          Os confrontos do R32 são semeados a partir da sua classificação derivada. Toque em quem
          avança em cada jogo, fase por fase, até a Final. Sem placares aqui.
        </p>
        {!matrixHit && (
          <p className="mt-2 font-sans text-[11px] text-warm-orange/80">
            ⚠ Distribuição dos 3ºs em modo provisório (tabela oficial FIFA pendente).
          </p>
        )}
      </div>

      <BracketView
        template={template}
        slots={slots}
        picks={picks}
        teamsMeta={teamsMeta}
        onPick={onPick}
        staleSet={staleSet}
        disabled={disabled}
      />

      <StepNav
        onPrev={onPrev}
        onNext={onNext}
        prevLabel="← Grupos"
        nextLabel="Finais →"
        center={
          <span className="font-sans text-xs text-cream/50">
            <strong className={`tabular ${done === total ? 'text-pitch-vivid' : 'text-brasil-gold'}`}>
              {done}
            </strong>
            /{total} confrontos
          </span>
        }
      />
    </div>
  )
}

export default BracketStep
