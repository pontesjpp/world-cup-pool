'use client'

// Painel recolhível "o que a galera achou": % por desfecho, histograma de
// placares, placar mais cravado, média de gols, cravadas exatas e Você vs a
// galera. Os dados já vêm calculados do servidor (computeMatchStats) — aqui é
// só estado de aberto/fechado, sem fetch.

import { useState } from 'react'
import { BarChart3, ChevronDown } from 'lucide-react'
import type { MatchStats as Stats } from '@/lib/matchStats'

type Props = {
  stats: Stats
  timeCasa: string
  timeFora: string
}

function abrev(nome: string) {
  return nome.length > 12 ? nome.slice(0, 11).trimEnd() + '…' : nome
}

// Barra de proporção genérica (rótulo · trilho · valor).
function Bar({
  label,
  pct,
  qtd,
  tone,
}: {
  label: string
  pct: number
  qtd?: number
  tone: 'casa' | 'empate' | 'fora' | 'gold'
}) {
  const fill =
    tone === 'casa'
      ? 'bg-classic-blue'
      : tone === 'fora'
        ? 'bg-warm-orange'
        : tone === 'empate'
          ? 'bg-cream/40'
          : 'bg-brasil-gold'
  return (
    <div className="flex items-center gap-3">
      <span className="w-[5.5rem] shrink-0 truncate text-right font-sans text-[11px] uppercase tracking-[0.12em] text-cream/55">
        {label}
      </span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-white/[0.06]">
        <div
          className={`h-full ${fill} transition-[width] duration-500`}
          style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
        />
      </div>
      <span className="tabular w-20 shrink-0 font-sans text-[11px] text-cream/70">
        <strong className="text-cream">{pct}%</strong>
        {qtd != null && <span className="text-cream/40"> · {qtd}</span>}
      </span>
    </div>
  )
}

export function MatchStats({ stats, timeCasa, timeFora }: Props) {
  const [open, setOpen] = useState(false)
  // Histograma: no fechado mostramos os 5 mais cravados; expandindo, todos.
  const [maisMostrados, setMaisMostrados] = useState(false)

  if (stats.total === 0) {
    return (
      <p className="mt-4 border-t border-white/10 pt-4 text-center font-sans text-[11px] uppercase tracking-[0.2em] text-cream/30">
        Ninguém palpitou neste jogo
      </p>
    )
  }

  const v = stats.vocePosicao
  const histVisivel = maisMostrados ? stats.histograma : stats.histograma.slice(0, 5)
  const maxQtd = stats.histograma[0]?.qtd ?? 1

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="motion-cinema flex w-full items-center justify-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brasil-gold/80 hover:text-brasil-gold"
      >
        <BarChart3 size={14} />
        {open ? 'Esconder estatísticas' : 'Ver o que a galera achou'}
        <span className="tabular text-cream/40">({stats.total})</span>
        <ChevronDown
          size={14}
          className={`motion-cinema ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="mt-5 space-y-6">
          {/* ── Quem vence (% por desfecho) ── */}
          <section className="space-y-2">
            <h4 className="font-sans text-[10px] font-bold uppercase tracking-[0.25em] text-cream/40">
              Quem leva a melhor
            </h4>
            <Bar label={abrev(timeCasa)} pct={stats.pctCasa} tone="casa" />
            <Bar label="Empate" pct={stats.pctEmpate} tone="empate" />
            <Bar label={abrev(timeFora)} pct={stats.pctFora} tone="fora" />
          </section>

          {/* ── Você vs a galera ── */}
          {v && (
            <section className="rounded-xl border border-brasil-gold/20 bg-brasil-gold/[0.06] p-3">
              <h4 className="mb-1 font-sans text-[10px] font-bold uppercase tracking-[0.25em] text-brasil-gold/70">
                Você vs a galera
              </h4>
              <p className="font-sans text-[13px] leading-snug text-cream/80">
                {v.seguiuMaioria ? (
                  <>Seu palpite seguiu a <strong className="text-cream">maioria</strong>.</>
                ) : (
                  <>Você foi <strong className="text-flare">contra a maré</strong>.</>
                )}{' '}
                {v.cravouSozinho ? (
                  <>Você foi o <strong className="text-brasil-gold">único</strong> a cravar esse placar.</>
                ) : (
                  <>
                    <strong className="tabular text-cream">{v.pctMesmoPlacar}%</strong> cravaram o
                    mesmo placar que você.
                  </>
                )}
              </p>
            </section>
          )}

          {/* ── Histograma de placares ── */}
          <section className="space-y-2">
            <h4 className="font-sans text-[10px] font-bold uppercase tracking-[0.25em] text-cream/40">
              Placares mais cravados
            </h4>
            {histVisivel.map((h) => (
              <div key={`${h.casa}-${h.fora}`} className="flex items-center gap-3">
                <span
                  className={`tabular w-12 shrink-0 text-right font-display text-base tracking-score ${
                    h.acertou ? 'text-pitch-vivid' : 'text-cream/80'
                  }`}
                >
                  {h.casa}–{h.fora}
                </span>
                <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-white/[0.06]">
                  <div
                    className={`h-full transition-[width] duration-500 ${
                      h.acertou ? 'bg-pitch-vivid' : 'bg-brasil-gold/70'
                    }`}
                    style={{ width: `${Math.max((h.qtd / maxQtd) * 100, 3)}%` }}
                  />
                </div>
                <span className="tabular w-20 shrink-0 font-sans text-[11px] text-cream/70">
                  <strong className="text-cream">{h.pct}%</strong>
                  <span className="text-cream/40"> · {h.qtd}</span>
                </span>
              </div>
            ))}
            {stats.histograma.length > 5 && (
              <button
                type="button"
                onClick={() => setMaisMostrados((m) => !m)}
                className="font-sans text-[11px] uppercase tracking-[0.15em] text-cream/40 hover:text-cream/70"
              >
                {maisMostrados
                  ? 'ver menos'
                  : `+ ${stats.histograma.length - 5} outros placares`}
              </button>
            )}
          </section>

          {/* ── Números rápidos ── */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.placarMaisCravado && (
              <Numero
                rotulo="Placar favorito"
                valor={`${stats.placarMaisCravado.casa}–${stats.placarMaisCravado.fora}`}
                nota={`${stats.placarMaisCravado.pct}% da galera`}
              />
            )}
            <Numero
              rotulo="Média prevista"
              valor={`${stats.mediaCasa} – ${stats.mediaFora}`}
              nota="gols por time"
            />
            {stats.exatos != null && (
              <Numero
                rotulo="Cravaram na mosca"
                valor={String(stats.exatos)}
                nota={stats.exatos === 1 ? 'pessoa acertou' : 'pessoas acertaram'}
                destaque={stats.exatos > 0}
              />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function Numero({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string
  valor: string
  nota: string
  destaque?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
      <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-cream/40">
        {rotulo}
      </p>
      <p
        className={`tabular mt-1 font-display text-2xl tracking-score ${
          destaque ? 'text-pitch-vivid' : 'text-cream'
        }`}
      >
        {valor}
      </p>
      <p className="font-sans text-[10px] text-cream/45">{nota}</p>
    </div>
  )
}

export default MatchStats
