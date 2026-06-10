'use client'

// ⚽ Match card como PÔSTER colecionável: camada de gramado, letra-fantasma
// do grupo ao fundo, placar gigante como centro de gravidade, CTA dourado.
// Mantém a lógica de palpite (server action) intacta.

import { useState, useTransition } from 'react'
import { salvarPalpite } from '@/actions/palpites'
import { ScoreInputs } from '@/components/ScoreInputs'
import { ScoreBig } from '@/components/ScoreBig'
import { TeamSide } from '@/components/TeamSide'
import { MatchStats } from '@/components/MatchStats'
import { PalpitesGalera } from '@/components/PalpitesGalera'
import type { Partida, Palpite } from '@/lib/types'
import type { MatchStats as Stats } from '@/lib/matchStats'
import type { RankedPalpite } from '@/lib/palpitesGalera'

type MatchCardProps = {
  partida: Partida
  palpite: Palpite | null
  locked: boolean
  stats?: Stats | null
  // Palpites nominais da galera (jogo em andamento → pontos provisórios).
  palpitesGalera?: RankedPalpite[]
  // Somente leitura: jogo de grupo agendado — palpite é feito/editado na Pré-Copa.
  // Mostra o placar palpitado, sem inputs, sem o aviso de "a bola já rolou".
  readOnly?: boolean
}

function formatData(iso: string) {
  const d = new Date(iso)
  const dia = d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '')
    .toUpperCase()
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia} • ${hora}`
}

const AO_VIVO = new Set(['IN_PLAY', 'PAUSED'])

export function MatchCard({
  partida,
  palpite,
  locked,
  stats,
  palpitesGalera,
  readOnly = false,
}: MatchCardProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const finished = partida.status === 'FINISHED'
  const aoVivo = AO_VIVO.has(partida.status)
  const grupoLetra = partida.grupo?.replace(/grupo\s*/i, '').trim() || null

  function onSubmit(formData: FormData) {
    setFeedback(null)
    startTransition(async () => {
      const res = await salvarPalpite(formData)
      setFeedback(res)
    })
  }

  const acertou = finished && palpite && palpite.pontos_obtidos > 0

  return (
    <form
      action={onSubmit}
      className="group motion-cinema shadow-poster relative overflow-hidden rounded-[20px] border border-white/10 bg-surface hover:-translate-y-0.5 hover:border-brasil-gold/30"
    >
      <input type="hidden" name="partidaId" value={partida.id} />

      {/* Camada de gramado escurecida */}
      <span className="turf-layer" aria-hidden />

      {/* Letra-fantasma gigante do grupo */}
      {grupoLetra && (
        <span className="ghost-number -right-2 top-1/2 -translate-y-1/2 text-[12rem] md:text-[15rem]">
          {grupoLetra}
        </span>
      )}

      <div className="relative z-10 p-5 md:p-7">
        {/* ── Faixa superior: fase/grupo · data/ao vivo ── */}
        <div className="mb-6 flex items-center justify-between">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-brasil-gold">
            {partida.fase ?? 'Fase de Grupos'}
            {grupoLetra ? ` · Grupo ${grupoLetra}` : ''}
          </span>
          {aoVivo ? (
            <span className="flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-flare">
              <span className="h-2 w-2 animate-pulse rounded-full bg-flare" /> Ao vivo
            </span>
          ) : (
            <span className="tabular font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-cream/50">
              {formatData(partida.data_jogo)}
            </span>
          )}
        </div>

        {/* ── Linha principal: time · placar · time ── */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-5">
          <TeamSide nome={partida.time_casa} crest={partida.crest_casa} align="right" />

          {/* Centro de gravidade: o placar */}
          <div className="flex flex-col items-center justify-self-center">
            {finished || aoVivo ? (
              <ScoreBig casa={partida.placar_casa} fora={partida.placar_fora} live={aoVivo} />
            ) : locked || readOnly ? (
              <span className="font-display text-5xl tracking-score text-cream/30 md:text-6xl">
                VS
              </span>
            ) : (
              <ScoreInputs
                casaName="palpiteCasa"
                foraName="palpiteFora"
                defaultCasa={palpite?.palpite_casa ?? null}
                defaultFora={palpite?.palpite_fora ?? null}
              />
            )}
          </div>

          <TeamSide nome={partida.time_fora} crest={partida.crest_fora} align="left" />
        </div>

        {/* ── Rodapé: resultado/pontos quando encerrado ── */}
        {finished && (
          <div className="mt-6 flex items-center justify-center gap-4 border-t border-white/10 pt-4 text-sm">
            {palpite ? (
              <>
                <span className="font-sans text-cream/50">
                  Seu palpite:{' '}
                  <strong className="tabular text-cream">
                    {palpite.palpite_casa} — {palpite.palpite_fora}
                  </strong>
                </span>
                <span
                  className={`tabular font-display text-lg uppercase tracking-wide ${
                    acertou ? 'text-pitch-vivid' : 'text-cream/40'
                  }`}
                >
                  +{palpite.pontos_obtidos} pts
                </span>
              </>
            ) : (
              <span className="font-sans text-cream/40">Você não palpitou neste jogo</span>
            )}
          </div>
        )}

        {/* ── CTA dourado: só quando dá pra palpitar ── */}
        {!locked && !readOnly && (
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="motion-cinema rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-7 py-3 font-display text-sm uppercase tracking-[0.15em] text-void shadow-lg shadow-brasil-gold/20 hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? 'Salvando…' : palpite ? 'Atualizar palpite' : 'Cravar placar'}
            </button>
            {feedback && (
              <span
                className={`font-sans text-sm font-medium ${
                  feedback.ok ? 'text-pitch-vivid' : 'text-flare'
                }`}
              >
                {feedback.message}
              </span>
            )}
          </div>
        )}

        {/* Jogo travado (já rolou) ou somente leitura (grupo agendado): mostra
            seu palpite pra contexto, sem inputs. */}
        {(locked || readOnly) && !finished && (
          <div className="mt-6 flex items-center justify-center gap-4 border-t border-white/10 pt-4 text-sm">
            {palpite ? (
              <span className="font-sans text-cream/50">
                Seu palpite:{' '}
                <strong className="tabular text-cream">
                  {palpite.palpite_casa} — {palpite.palpite_fora}
                </strong>
              </span>
            ) : readOnly ? (
              <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-cream/40">
                Sem palpite — crave na aba Pré-Copa
              </span>
            ) : (
              <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-cream/40">
                🔒 Palpites encerrados — a bola já rolou
              </span>
            )}
          </div>
        )}

        {stats && (
          <MatchStats stats={stats} timeCasa={partida.time_casa} timeFora={partida.time_fora} />
        )}

        {palpitesGalera && palpitesGalera.length > 0 && (
          <PalpitesGalera palpites={palpitesGalera} live={!finished} />
        )}
      </div>
    </form>
  )
}
