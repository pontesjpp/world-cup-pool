'use client'

import type { StepId } from './types'

// Indicador de progresso: pips A..L + chips (Chave / Finais / Enviar).
export function WizardStepper({
  groups,
  step,
  onStep,
  groupDone,
  terceirosDone,
  bracketDone,
  finaisDone,
}: {
  groups: string[]
  step: StepId
  onStep: (s: StepId) => void
  groupDone: Record<string, boolean>
  terceirosDone: boolean
  bracketDone: boolean
  finaisDone: boolean
}) {
  const chip = (id: StepId, label: string, done: boolean) => (
    <button
      key={id}
      type="button"
      onClick={() => onStep(id)}
      className={`motion-cinema shrink-0 rounded-full border px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] ${
        step === id
          ? 'border-brasil-gold bg-brasil-gold/15 text-brasil-gold'
          : done
            ? 'border-pitch-vivid/40 text-pitch-vivid'
            : 'border-white/10 text-cream/45 hover:text-cream'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1.5">
      {groups.map((g) => {
        const id = `grupo-${g}`
        const done = groupDone[g]
        const current = step === id
        return (
          <button
            key={g}
            type="button"
            onClick={() => onStep(id)}
            aria-label={`Grupo ${g}`}
            className={`motion-cinema flex h-7 w-7 items-center justify-center rounded-full border font-display text-sm ${
              current
                ? 'border-brasil-gold bg-brasil-gold/15 text-brasil-gold ring-1 ring-brasil-gold/40'
                : done
                  ? 'border-pitch-vivid/50 bg-pitch-vivid/10 text-pitch-vivid'
                  : 'border-white/10 text-cream/40 hover:text-cream'
            }`}
          >
            {g}
          </button>
        )
      })}
      <span className="mx-1 h-4 w-px bg-white/10" />
      {chip('terceiros', '3 Lugares', terceirosDone)}
      {chip('chaveamento', 'Chave', bracketDone)}
      {chip('finais', 'Finais', finaisDone)}
      {chip('revisao', 'Enviar', false)}
    </div>
  )
}

export default WizardStepper
