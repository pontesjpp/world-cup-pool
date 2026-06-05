// Placar oficial gigante (encerrado / ao vivo). Centro de gravidade do card.
export function ScoreBig({
  casa,
  fora,
  live = false,
}: {
  casa: number | null
  fora: number | null
  live?: boolean
}) {
  return (
    <div className="tabular flex items-center gap-3 font-display leading-none tracking-score text-cream">
      <span className="text-6xl md:text-7xl">{casa ?? 0}</span>
      <span className={`text-3xl md:text-4xl ${live ? 'text-flare' : 'text-brasil-gold'}`}>—</span>
      <span className="text-6xl md:text-7xl">{fora ?? 0}</span>
    </div>
  )
}

export default ScoreBig
