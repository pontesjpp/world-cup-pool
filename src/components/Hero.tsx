import Image from 'next/image'
import Link from 'next/link'
import StatRing from './home/StatRing'
import type { HomeStats } from '@/lib/homeStats'

// ⚽ Hero cinematográfico FULL-BLEED: foto do Neymar ocupando a tela inteira,
// dissolvendo para o fundo escuro embaixo — continuidade direta com "Próximos
// Jogos". Conteúdo (texto + stats + CTA) sobreposto na faixa legível.
type HeroProps = {
  nome: string
  stats: HomeStats
  jogosAbertos: number
}

export default function Hero({ nome, stats, jogosAbertos }: HeroProps) {
  return (
    <section className="full-bleed relative -mt-4 flex min-h-[88vh] flex-col justify-end overflow-hidden">
      {/* Foto em tela cheia */}
      <Image
        src="/icons/neymar.jpg"
        alt="Comemoração — Copa do Mundo"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[60%_28%]"
      />

      {/* Tratamento cinematográfico */}
      {/* escurece à esquerda p/ legibilidade do texto */}
      <div className="absolute inset-0 bg-gradient-to-r from-void via-void/45 to-transparent md:from-void/95 md:via-void/30" />
      {/* vinheta nos cantos */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_65%_35%,transparent_35%,rgba(8,12,11,0.55)_100%)]" />
      {/* DISSOLVE inferior: a foto derrete no fundo (#0b1110) → continuidade */}
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-void via-void/85 to-transparent" />
      {/* grão de filme */}
      <div className="halftone pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay" />

      {/* Conteúdo, ancorado embaixo, dentro da largura central */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-12 pt-16 md:pb-16">
        <div className="animate-fade-rise">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-[2px] w-10 bg-brasil-gold" />
            <span className="font-sans text-xs font-semibold uppercase tracking-[0.35em] text-brasil-gold">
              E aí, {nome.split(' ')[0]}
            </span>
          </div>

          <h1 className="font-display uppercase leading-[0.8] tracking-tight text-cream drop-shadow-[0_4px_40px_rgba(0,0,0,0.7)]">
            <span className="block text-[16vw] sm:text-[12vw] md:text-[8.5rem]">Copa do</span>
            <span className="block text-[16vw] text-brasil-gold sm:text-[12vw] md:text-[8.5rem]">
              Mundo
            </span>
            <span className="block text-[16vw] sm:text-[12vw] md:text-[8.5rem]">2026</span>
          </h1>

          <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-cream/70 md:text-base">
            Crava cada placar. Escala o ranking. Vira campeão da galera.
          </p>

          {/* Stats do usuário */}
          <div className="mt-8 flex items-center gap-6 md:gap-9">
            <StatRing pct={stats.completionPct} label="Palpites feitos" />
            <BigStat value={String(stats.points)} label="Pontos" />
            <BigStat value={stats.position ? `#${stats.position}` : '—'} label="No ranking" />
            <BigStat
              value={`${stats.accuracyPct}%`}
              label="Aproveitamento"
              hideOnMobile
            />
          </div>

          {/* CTA */}
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/pre-copa"
              className="motion-cinema rounded-[14px] bg-gradient-to-br from-brasil-gold to-[#FFDD66] px-8 py-[18px] font-display text-base uppercase tracking-[0.12em] text-black shadow-lg shadow-brasil-gold/25 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
            >
              Fazer palpites
            </Link>
            {jogosAbertos > 0 && (
              <span className="font-sans text-sm text-cream/55">
                <strong className="tabular text-brasil-gold">{jogosAbertos}</strong>{' '}
                {jogosAbertos === 1 ? 'jogo aberto' : 'jogos abertos'} agora
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function BigStat({
  value,
  label,
  hideOnMobile,
}: {
  value: string
  label: string
  hideOnMobile?: boolean
}) {
  return (
    <div className={`flex flex-col ${hideOnMobile ? 'hidden sm:flex' : ''}`}>
      <span className="tabular font-display text-4xl leading-none text-cream md:text-5xl">
        {value}
      </span>
      <span className="mt-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/45">
        {label}
      </span>
    </div>
  )
}
