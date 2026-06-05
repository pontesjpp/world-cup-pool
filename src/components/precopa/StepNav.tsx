'use client'

import type { ReactNode } from 'react'

// Barra de navegação inferior do passo (anterior / centro / próximo).
export function StepNav({
  onPrev,
  onNext,
  prevLabel = '← Anterior',
  nextLabel = 'Próximo →',
  center,
}: {
  onPrev?: () => void
  onNext?: () => void
  prevLabel?: string
  nextLabel?: ReactNode
  center?: ReactNode
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
      {onPrev ? (
        <button
          type="button"
          onClick={onPrev}
          className="motion-cinema shrink-0 rounded-xl border border-white/10 px-4 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-cream/60 hover:border-white/25 hover:text-cream"
        >
          {prevLabel}
        </button>
      ) : (
        <span />
      )}

      {center && <div className="min-w-0 flex-1 text-center">{center}</div>}

      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          className="motion-cinema shrink-0 rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-6 py-2.5 font-display text-sm uppercase tracking-[0.15em] text-void shadow-lg shadow-brasil-gold/20 hover:brightness-105 active:scale-[0.98]"
        >
          {nextLabel}
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

export default StepNav
