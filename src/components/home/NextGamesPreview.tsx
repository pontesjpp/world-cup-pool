import Image from 'next/image'
import Link from 'next/link'
import { SectionHeader } from './RankingPreview'
import type { Partida, Palpite } from '@/lib/types'

function formatData(iso: string) {
  const d = new Date(iso)
  const dia = d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '')
    .toUpperCase()
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia} • ${hora}`
}

// Prévia dos próximos jogos na home: 3 jogos + o palpite do usuário (ou "– –").
export default function NextGamesPreview({
  games,
  palpitesByPartida,
}: {
  games: Partida[]
  palpitesByPartida: Map<string, Palpite>
}) {
  return (
    <section className="mb-16">
      <SectionHeader
        eyebrow="A Tabela"
        title="Próximos Jogos"
        href="/proximosjogos"
        cta="Ver tudo"
      />

      <div className="overflow-hidden rounded-[20px] border border-white/10 bg-surface">
        <div className="divide-y divide-white/5">
          {games.map((p) => {
            const g = palpitesByPartida.get(p.id)
            const grupo = p.grupo?.replace(/grupo\s*/i, '').trim()
            return (
              <Link
                key={p.id}
                href="/proximosjogos"
                className="motion-cinema block px-5 py-4 hover:bg-white/[0.03] md:px-7"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-brasil-gold">
                    {p.fase ?? 'Fase de Grupos'}
                    {grupo ? ` · Grupo ${grupo}` : ''}
                  </span>
                  <span className="tabular font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-cream/45">
                    {formatData(p.data_jogo)}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <Team nome={p.time_casa} crest={p.crest_casa} align="right" />

                  <div className="flex flex-col items-center">
                    {g ? (
                      <span className="tabular font-display text-2xl leading-none text-cream md:text-3xl">
                        {g.palpite_casa}
                        <span className="px-1.5 text-brasil-gold">–</span>
                        {g.palpite_fora}
                      </span>
                    ) : (
                      <span className="font-display text-2xl leading-none text-cream/30 md:text-3xl">
                        –&nbsp;&nbsp;–
                      </span>
                    )}
                    <span className="mt-1.5 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-cream/35">
                      {g ? 'seu palpite' : 'sem palpite'}
                    </span>
                  </div>

                  <Team nome={p.time_fora} crest={p.crest_fora} align="left" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Team({
  nome,
  crest,
  align,
}: {
  nome: string
  crest: string | null
  align: 'left' | 'right'
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${
        align === 'right' ? 'flex-row-reverse text-right' : 'text-left'
      }`}
    >
      {crest && (
        <Image
          src={crest}
          alt={nome}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 object-contain"
          unoptimized
        />
      )}
      <p className="min-w-0 truncate font-display text-base uppercase leading-none tracking-wide text-cream md:text-lg">
        {nome}
      </p>
    </div>
  )
}
