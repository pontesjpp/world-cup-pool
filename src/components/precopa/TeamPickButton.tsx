'use client'

import Image from 'next/image'
import type { Team } from '@/lib/types'

// Pílula de seleção: toque marca o time como "avança". Usada no bracket e no
// seletor de surpresa.
export function TeamPickButton({
  team,
  selected,
  dim,
  disabled,
  onClick,
  placeholder = 'A definir',
}: {
  team: Team | null
  selected?: boolean
  dim?: boolean
  disabled?: boolean
  onClick?: () => void
  placeholder?: string
}) {
  const empty = !team
  return (
    <button
      type="button"
      disabled={disabled || empty}
      onClick={onClick}
      className={`motion-cinema flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left ${
        selected
          ? 'border-brasil-gold bg-brasil-gold/12 text-cream'
          : empty
            ? 'border-dashed border-white/10 text-cream/30'
            : dim
              ? 'border-white/5 text-cream/35 opacity-60'
              : 'border-white/10 text-cream hover:border-brasil-gold/40 hover:bg-white/[0.03]'
      } disabled:cursor-not-allowed`}
    >
      {team?.crest ? (
        <Image
          src={team.crest}
          alt={team.name}
          width={28}
          height={28}
          className="h-6 w-6 shrink-0 object-contain"
          unoptimized
        />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-white/15" />
      )}
      <span className="min-w-0 flex-1 truncate font-display text-sm uppercase tracking-wide">
        {team?.name ?? placeholder}
      </span>
      {selected && <span className="shrink-0 font-sans text-[10px] uppercase tracking-[0.15em] text-brasil-gold">✓</span>}
    </button>
  )
}

export default TeamPickButton
