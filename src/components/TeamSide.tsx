import Image from 'next/image'

// Lado do time: escudo + nome em fonte display. Reutilizado em MatchCard,
// StandingsTable, TeamPickButton, FinishedMatchCard, previews.

type Size = 'sm' | 'md' | 'lg'

const CREST: Record<Size, string> = {
  sm: 'h-7 w-7',
  md: 'h-11 w-11 md:h-12 md:w-12',
  lg: 'h-14 w-14 md:h-16 md:w-16',
}
const TEXT: Record<Size, string> = {
  sm: 'text-base',
  md: 'text-xl md:text-2xl',
  lg: 'text-2xl md:text-3xl',
}

export function TeamSide({
  nome,
  crest,
  align = 'left',
  size = 'md',
  muted = false,
}: {
  nome: string
  crest?: string | null
  align?: 'left' | 'right'
  size?: Size
  muted?: boolean
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${
        align === 'right' ? 'flex-row-reverse text-right' : 'text-left'
      }`}
    >
      {crest && (
        <Image
          src={crest}
          alt={nome}
          width={64}
          height={64}
          className={`${CREST[size]} shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]`}
          unoptimized
        />
      )}
      <p
        className={`min-w-0 truncate font-display uppercase leading-none tracking-wide ${TEXT[size]} ${
          muted ? 'text-cream/40' : 'text-cream'
        }`}
      >
        {nome}
      </p>
    </div>
  )
}

export default TeamSide
