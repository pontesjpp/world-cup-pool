'use client'

import { Countdown } from '@/components/Countdown'
import { StepNav } from './StepNav'

function Meter({ label, value, total, ok }: { label: string; value: number; total: number; ok: boolean }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/55">
          {label}
        </span>
        <span className={`tabular font-display text-lg ${ok ? 'text-pitch-vivid' : 'text-brasil-gold'}`}>
          {value}/{total}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${ok ? 'bg-pitch-vivid' : 'bg-brasil-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function RevisaoStep({
  scoresFilled,
  scoresTotal,
  bracketDone,
  bracketTotal,
  finaisDone,
  deadline,
  frozen,
  submitted,
  submitting,
  message,
  onSubmit,
  onPrev,
}: {
  scoresFilled: number
  scoresTotal: number
  bracketDone: number
  bracketTotal: number
  finaisDone: boolean
  deadline: string | null
  frozen: boolean
  submitted: boolean
  submitting: boolean
  message: string | null
  onSubmit: () => void
  onPrev: () => void
}) {
  const complete = scoresFilled === scoresTotal && bracketDone === bracketTotal && finaisDone

  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            Última conferida
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-6xl">
          {submitted ? (
            <>Pré-Copa <span className="text-pitch-vivid">enviada</span></>
          ) : (
            <>Revisão & <span className="text-brasil-gold">Envio</span></>
          )}
        </h1>
        {deadline && !submitted && (
          <p className="mt-3 font-sans text-sm text-cream/55">
            Fecha em{' '}
            <Countdown target={deadline} className="font-display text-brasil-gold" />{' '}
            (24h antes da abertura).
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Meter label="Placares de grupo" value={scoresFilled} total={scoresTotal} ok={scoresFilled === scoresTotal} />
        <Meter label="Chaveamento" value={bracketDone} total={bracketTotal} ok={bracketDone === bracketTotal} />
        <Meter label="Finais" value={finaisDone ? 4 : 0} total={4} ok={finaisDone} />
      </div>

      {submitted ? (
        <div className="mt-8 rounded-2xl border border-pitch-vivid/30 bg-pitch-vivid/[0.06] p-6 text-center">
          <p className="font-display text-2xl uppercase tracking-wide text-pitch-vivid">
            Tudo certo! 🏆
          </p>
          <p className="mt-2 font-sans text-sm text-cream/60">
            Sua pré-Copa foi registrada e congelada. Agora é torcer.
          </p>
        </div>
      ) : frozen ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-surface p-6 text-center">
          <p className="font-display text-xl uppercase tracking-wide text-cream/60">
            🔒 Prazo encerrado
          </p>
          <p className="mt-2 font-sans text-sm text-cream/50">
            O prazo da pré-Copa fechou — não é mais possível enviar.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !complete}
            className="motion-cinema w-full max-w-sm rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-8 py-4 font-display text-base uppercase tracking-[0.15em] text-void shadow-lg shadow-brasil-gold/20 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Enviando…' : 'Enviar pré-Copa'}
          </button>
          {!complete && (
            <p className="font-sans text-xs text-cream/45">
              Complete todos os itens acima para liberar o envio.
            </p>
          )}
          {message && (
            <p className="font-sans text-sm font-medium text-flare">{message}</p>
          )}
        </div>
      )}

      <StepNav onPrev={onPrev} prevLabel="← Finais" />
    </div>
  )
}

export default RevisaoStep
