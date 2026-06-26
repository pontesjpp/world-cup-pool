'use client'

// Visualizador read-only do mata-mata: escolhe um participante e vê o bracket
// dele reconstruído (mesma lógica do motor de pontuação). Sem edição — editar
// segue só na Pré-Copa. Antes do prazo, a RLS só entrega o próprio bracket;
// depois do prazo, todos. Quando o mata-mata começar, mostra os pontos por slot.

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { THIRD_PLACE_MATRIX } from '@/lib/thirdPlaceMatrix'
import { buildUserSlots, type ClassRow } from '@/lib/matamata'
import { ROUND_LABEL, ROUND_SEQ } from '@/components/precopa/BracketView'
import { TeamPickButton } from '@/components/precopa/TeamPickButton'
import type { BracketRound, BracketSlot, Team } from '@/lib/types'
import type { SlotParticipants } from '@/lib/bracket'

export type MataMataPlayer = {
  user_id: string
  nome: string
  avatar_url: string | null
  submitted: boolean
  picks: Record<string, string>
  classificacao: ClassRow[]
  finais: { campeao: string | null; vice: string | null; terceiro: string | null; surpresa: string | null }
  pontosBySlot: Record<string, number>
  totalPts: number
}

type Props = {
  meId: string | null
  players: MataMataPlayer[]
  template: BracketSlot[]
  teamsMeta: Record<string, Team>
  actualSlots: Record<string, SlotParticipants>
  fechada: boolean
  deadlineLabel: string | null
}

function Avatar({ nome, url, size = 44 }: { nome: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={nome}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-white/10 object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-void/60 font-display uppercase text-cream/70"
      style={{ width: size, height: size }}
    >
      {nome.charAt(0)}
    </div>
  )
}

export function BracketViewer({
  meId,
  players,
  template,
  teamsMeta,
  actualSlots,
  fechada,
  deadlineLabel,
}: Props) {
  // "Você" primeiro, depois alfabético.
  const ordered = useMemo(() => {
    return [...players].sort((a, b) => {
      if (a.user_id === meId) return -1
      if (b.user_id === meId) return 1
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [players, meId])

  const [selectedId, setSelectedId] = useState<string | null>(ordered[0]?.user_id ?? null)
  const [active, setActive] = useState<BracketRound>('R32')

  const selected = ordered.find((p) => p.user_id === selectedId) ?? ordered[0] ?? null

  const slots = useMemo<Record<string, SlotParticipants>>(() => {
    if (!selected) return {}
    return buildUserSlots(template, THIRD_PLACE_MATRIX, selected.classificacao, selected.picks)
  }, [selected, template])

  if (ordered.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
        <span className="turf-layer" aria-hidden />
        <p className="relative z-10 font-sans text-cream/55">
          Nenhum bracket disponível ainda. Monte o seu na aba <strong className="text-cream">Pré-Copa</strong>.
        </p>
      </div>
    )
  }

  const rounds = ROUND_SEQ.filter((r) => template.some((s) => s.round === r))
  const slotsOfRound = template
    .filter((s) => s.round === active)
    .sort((a, b) => a.match_no - b.match_no)
  const meta = (name: string | null): Team | null => (name ? teamsMeta[name] ?? { name, crest: null } : null)
  const temResultados = Object.keys(actualSlots).length > 0

  return (
    <div className="space-y-6">
      {/* ── Seletor de participante ── */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.25em] text-cream/40">
            Bracket de
          </span>
          {temResultados && selected && (
            <span className="tabular font-display text-sm uppercase tracking-wide text-pitch-vivid">
              {selected.totalPts} pts no mata-mata
            </span>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ordered.map((p) => {
            const isMe = p.user_id === meId
            const sel = p.user_id === selected?.user_id
            return (
              <button
                key={p.user_id}
                type="button"
                onClick={() => setSelectedId(p.user_id)}
                title={p.nome}
                className={`motion-cinema flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-3 py-2.5 ${
                  sel
                    ? 'border-brasil-gold bg-brasil-gold/10'
                    : 'border-white/10 bg-surface hover:border-brasil-gold/30'
                }`}
              >
                <Avatar nome={p.nome} url={p.avatar_url} size={44} />
                <span
                  className={`max-w-[5.5rem] truncate font-sans text-[11px] font-semibold ${
                    sel ? 'text-brasil-gold' : 'text-cream/70'
                  }`}
                >
                  {isMe ? 'Você' : p.nome.split(' ')[0]}
                </span>
                {!p.submitted && (
                  <span className="font-sans text-[9px] uppercase tracking-[0.12em] text-warm-orange/80">
                    rascunho
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {!fechada && (
          <p className="mt-3 rounded-xl border border-brasil-gold/20 bg-brasil-gold/[0.06] px-3 py-2 font-sans text-[12px] leading-snug text-cream/75">
            Os brackets dos outros participantes liberam quando a Pré-Copa fechar
            {deadlineLabel ? ` (${deadlineLabel})` : ''}. Por enquanto, só o seu fica visível.
          </p>
        )}
      </div>

      {/* ── Resumo das finais ── */}
      {selected && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Finalista rotulo="Campeão" time={meta(selected.finais.campeao)} destaque />
          <Finalista rotulo="Vice" time={meta(selected.finais.vice)} />
          <Finalista rotulo="3º lugar" time={meta(selected.finais.terceiro)} />
          <Finalista rotulo="Surpresa" time={meta(selected.finais.surpresa)} />
        </div>
      )}

      {/* ── Bracket por rodada (read-only) ── */}
      <div>
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {rounds.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActive(r)}
              className={`motion-cinema shrink-0 rounded-full border px-3.5 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] ${
                active === r
                  ? 'border-brasil-gold bg-brasil-gold/15 text-brasil-gold'
                  : 'border-white/10 text-cream/45 hover:text-cream'
              }`}
            >
              {ROUND_LABEL[r]}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {slotsOfRound.map((s) => {
            const part = slots[s.slot_key] ?? { home: null, away: null }
            const pick = selected?.picks[s.slot_key]
            const pts = selected?.pontosBySlot[s.slot_key]
            const mostraPts = temResultados && pts != null
            // Acertou o slot inteiro = pontuação cheia (ambos os participantes
            // certos = points_per_slot × 2). Pinta o card todo de verde.
            const acertouSlot = mostraPts && s.points_per_slot > 0 && pts === s.points_per_slot * 2
            // Acerto parcial: esverdeia só o time que está no confronto real.
            const actual = actualSlots[s.slot_key]
            const inActual = (team: string | null) =>
              !acertouSlot && temResultados && !!actual && !!team &&
              (actual.home === team || actual.away === team)
            return (
              <div
                key={s.slot_key}
                className={`rounded-2xl border p-2.5 ${
                  acertouSlot ? 'border-pitch-vivid bg-pitch-vivid/10' : 'border-white/10 bg-surface'
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-cream/35">
                    {ROUND_LABEL[s.round]} · {s.match_no}
                  </span>
                  {mostraPts && (
                    <span
                      className={`tabular font-display text-[11px] uppercase tracking-wide ${
                        (pts ?? 0) > 0 ? 'text-pitch-vivid' : 'text-cream/30'
                      }`}
                    >
                      +{pts}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <TeamPickButton team={meta(part.home)} selected={!!pick && pick === part.home} dim={!!pick && pick !== part.home} disabled correct={inActual(part.home)} />
                  <TeamPickButton team={meta(part.away)} selected={!!pick && pick === part.away} dim={!!pick && pick !== part.away} disabled correct={inActual(part.away)} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Finalista({ rotulo, time, destaque }: { rotulo: string; time: Team | null; destaque?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-2.5 ${
        destaque ? 'border-brasil-gold/40 bg-brasil-gold/[0.06]' : 'border-white/10 bg-surface'
      }`}
    >
      <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-cream/40">{rotulo}</p>
      <div className="mt-1 flex items-center gap-2">
        {time?.crest ? (
          <Image src={time.crest} alt={time.name} width={20} height={20} className="h-5 w-5 shrink-0 object-contain" unoptimized />
        ) : (
          <span className="h-5 w-5 shrink-0 rounded-full border border-dashed border-white/15" />
        )}
        <span className={`min-w-0 truncate font-display text-sm uppercase tracking-wide ${destaque ? 'text-brasil-gold' : 'text-cream'}`}>
          {time?.name ?? '—'}
        </span>
      </div>
    </div>
  )
}

export default BracketViewer
