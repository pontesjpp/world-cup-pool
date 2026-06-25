'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'

type GroupPrediction = {
  position: number
  team: string
  correct: boolean | null // null = group not yet finished
}

type GroupData = {
  letra: string
  finished: boolean
  actualStandings: { position: number; team: string }[]
  predictions: GroupPrediction[]
  ptsGanhos: number
  grupoCompleto: boolean
}

export type ClassPlayer = {
  user_id: string
  nome: string
  avatar_url: string | null
  submitted: boolean
  grupos: GroupData[]
  totalPts: number
}

type Props = {
  meId: string | null
  players: ClassPlayer[]
  pts_posicao: number
  pts_grupo_completo: number
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
      className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-void/60 font-display text-sm uppercase text-cream/70"
      style={{ width: size, height: size }}
    >
      {nome.charAt(0)}
    </div>
  )
}

export function ClassificacaoViewer({ meId, players, pts_posicao, pts_grupo_completo }: Props) {
  const ordered = useMemo(
    () =>
      [...players].sort((a, b) => {
        if (a.user_id === meId) return -1
        if (b.user_id === meId) return 1
        return a.nome.localeCompare(b.nome, 'pt-BR')
      }),
    [players, meId],
  )

  const [selectedId, setSelectedId] = useState<string | null>(ordered[0]?.user_id ?? null)
  const selected = ordered.find((p) => p.user_id === selectedId) ?? ordered[0] ?? null

  if (ordered.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
        <p className="relative z-10 font-sans text-cream/55">
          Nenhum palpite de classificação disponível ainda. Monte o seu na{' '}
          <strong className="text-cream">Pré-Copa</strong>.
        </p>
      </div>
    )
  }

  const finishedCount = selected?.grupos.filter((g) => g.finished).length ?? 0
  const totalGroups = selected?.grupos.length ?? 0

  return (
    <div className="space-y-6">
      {/* ── Seletor de participante ── */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.25em] text-cream/40">
            Classificação de
          </span>
          {selected && selected.totalPts > 0 && (
            <span className="tabular font-display text-sm uppercase tracking-wide text-pitch-vivid">
              {selected.totalPts} pts ganhos
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
      </div>

      {/* ── Legenda de progresso ── */}
      {selected && finishedCount < totalGroups && (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-sans text-[12px] leading-snug text-cream/50">
          {finishedCount === 0
            ? 'Nenhum grupo encerrou ainda — as posições aparecem quando todos os jogos de um grupo terminarem.'
            : `${finishedCount} de ${totalGroups} grupos encerrados. Os demais aparecem quando os jogos terminarem.`}
        </p>
      )}

      {/* ── Grid de grupos ── */}
      {selected && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {selected.grupos.map((grupo) => (
            <GroupCard
              key={grupo.letra}
              grupo={grupo}
              pts_posicao={pts_posicao}
              pts_grupo_completo={pts_grupo_completo}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupCard({
  grupo,
  pts_posicao,
  pts_grupo_completo,
}: {
  grupo: GroupData
  pts_posicao: number
  pts_grupo_completo: number
}) {
  const { letra, finished, predictions, ptsGanhos, grupoCompleto } = grupo

  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-base uppercase tracking-wide text-cream">
          Grupo {letra}
        </span>
        <div className="flex items-center gap-2">
          {grupoCompleto && (
            <span className="rounded-full bg-pitch-vivid/15 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.12em] text-pitch-vivid">
              completo
            </span>
          )}
          {finished && ptsGanhos > 0 && (
            <span className="tabular font-display text-sm tracking-wide text-pitch-vivid">
              +{ptsGanhos}
            </span>
          )}
          {!finished && (
            <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-cream/25">
              em jogo
            </span>
          )}
        </div>
      </div>

      {/* Position rows */}
      <div className="space-y-1.5">
        {predictions.map((pred) => {
          const isCorrect = pred.correct === true
          const isWrong = pred.correct === false

          return (
            <div
              key={pred.position}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${
                isCorrect
                  ? 'border border-pitch-vivid/25 bg-pitch-vivid/10'
                  : isWrong
                    ? 'border border-flare/20 bg-flare/[0.07]'
                    : 'border border-white/5 bg-white/[0.02]'
              }`}
            >
              <span
                className={`w-5 shrink-0 font-display text-sm tabular ${
                  isCorrect ? 'text-pitch-vivid' : isWrong ? 'text-flare/60' : 'text-cream/25'
                }`}
              >
                {pred.position}°
              </span>

              <span
                className={`min-w-0 flex-1 truncate font-sans text-sm ${
                  isCorrect
                    ? 'font-semibold text-cream'
                    : isWrong
                      ? 'font-normal text-cream/55'
                      : 'font-normal text-cream/70'
                }`}
              >
                {pred.team}
              </span>

              {isCorrect && (
                <span className="shrink-0 tabular font-display text-xs text-pitch-vivid">
                  +{pts_posicao}
                </span>
              )}
              {isWrong && (
                <span className="shrink-0 font-sans text-[11px] text-flare/50">✗</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Bonus row for complete group */}
      {grupoCompleto && (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-pitch-vivid/20 bg-pitch-vivid/[0.08] px-2.5 py-1.5">
          <span className="font-sans text-[11px] text-pitch-vivid/80">Bônus grupo completo</span>
          <span className="tabular font-display text-sm text-pitch-vivid">+{pts_grupo_completo}</span>
        </div>
      )}
    </div>
  )
}
