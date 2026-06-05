import type { HomeStats } from '@/lib/homeStats'

// Performance recente: pontos dos últimos jogos + "forma" (bolinhas de acerto/erro).
export default function RecentForm({ stats }: { stats: HomeStats }) {
  if (!stats.recent) return null
  const { points, exact, correct, count } = stats.recent

  return (
    <section className="mb-16">
      <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-7 shadow-poster md:p-9">
        <span className="turf-layer" aria-hidden />
        <span className="ghost-number -right-2 top-1/2 -translate-y-1/2 text-[10rem] md:text-[13rem]">
          {points >= 0 ? `+${points}` : points}
        </span>

        <div className="relative z-10 flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="h-[2px] w-8 bg-brasil-gold" />
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
                Sua forma
              </span>
            </div>
            <p className="font-sans text-sm text-cream/55">
              Últimos {count} {count === 1 ? 'jogo encerrado' : 'jogos encerrados'}
            </p>
            <p className="mt-3 font-display text-5xl uppercase leading-none tracking-tight text-cream md:text-6xl">
              <span className="text-pitch-vivid">+{points}</span>{' '}
              <span className="text-3xl text-cream/70 md:text-4xl">pts</span>
            </p>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="tabular font-display text-4xl text-cream">{exact}</span>
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/45">
                placares exatos
              </span>
            </div>
            <div className="flex flex-col">
              <span className="tabular font-display text-4xl text-cream">{correct}</span>
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/45">
                resultados certos
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5">
                {stats.form.map((scored, i) => (
                  <span
                    key={i}
                    title={scored ? 'Pontuou' : 'Sem pontos'}
                    className={`h-3 w-3 rounded-full ${
                      scored ? 'bg-pitch-vivid' : 'bg-cream/15'
                    }`}
                  />
                ))}
              </div>
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/45">
                forma
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
