import type { HomeStats } from '@/lib/homeStats'

// Faixa horizontal editorial. Transparente, sobre o fundo escuro — segue
// direto a dissolução do hero (continuidade), sem caixa nem bordas duras.
export default function QuickStatsStrip({ stats }: { stats: HomeStats }) {
  const items: { value: string | number; label: string }[] = [
    { value: stats.predictedCount, label: 'jogos palpitados' },
    { value: stats.exactScores, label: 'placares exatos' },
    { value: stats.streak, label: 'em sequência' },
    { value: `${stats.accuracyPct}%`, label: 'aproveitamento' },
  ]

  return (
    <div className="mx-auto mb-14 flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 py-4 sm:gap-x-10">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-6 sm:gap-10">
          <div className="flex items-baseline gap-2">
            <span className="tabular block py-1 font-display text-2xl leading-none text-brasil-gold md:text-3xl">
              {it.value}
            </span>
            <span className="font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-cream/50">
              {it.label}
            </span>
          </div>
          {i < items.length - 1 && (
            <span className="hidden text-brasil-gold/40 sm:inline">•</span>
          )}
        </div>
      ))}
    </div>
  )
}
