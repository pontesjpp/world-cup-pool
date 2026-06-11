import { ScoreBig } from '@/components/ScoreBig'
import { TeamSide } from '@/components/TeamSide'
import { PointsBadge } from '@/components/PointsBadge'
import { MatchStats } from '@/components/MatchStats'
import { PalpitesGalera } from '@/components/PalpitesGalera'
import type { MatchStats as Stats } from '@/lib/matchStats'
import type { RankedPalpite } from '@/lib/palpitesGalera'

export type FinishedMatch = {
  id: string
  time_casa: string
  time_fora: string
  crest_casa: string | null
  crest_fora: string | null
  placar_casa: number | null
  placar_fora: number | null
  fase: string | null
  grupo: string | null
  data_jogo: string
  palpite: {
    palpite_casa: number
    palpite_fora: number
    pontos_obtidos: number
    categoria: string | null
    solitario: boolean
  } | null
}

function formatData(iso: string) {
  const d = new Date(iso)
  const dia = d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })
    .replace('.', '')
    .toUpperCase()
  const hora = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
  return `${dia} • ${hora}`
}

// Card de jogo encerrado: resultado oficial × seu palpite + pontos por categoria.
export function FinishedMatchCard({
  match,
  stats,
  palpitesGalera,
}: {
  match: FinishedMatch
  stats?: Stats | null
  palpitesGalera?: RankedPalpite[]
}) {
  const grupoLetra = match.grupo?.replace(/grupo\s*/i, '').trim() || null
  const p = match.palpite
  const pontuou = (p?.pontos_obtidos ?? 0) > 0

  return (
    <div className="group motion-cinema shadow-poster relative overflow-hidden rounded-[20px] border border-white/10 bg-surface">
      <span className="turf-layer" aria-hidden />
      {grupoLetra && (
        <span className="ghost-number -right-2 top-1/2 -translate-y-1/2 text-[12rem] md:text-[15rem]">
          {grupoLetra}
        </span>
      )}

      <div className="relative z-10 p-5 md:p-7">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-brasil-gold">
            {match.fase ?? 'Fase de Grupos'}
            {grupoLetra ? ` · Grupo ${grupoLetra}` : ''}
          </span>
          <span className="tabular font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-cream/50">
            {formatData(match.data_jogo)}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-5">
          <TeamSide nome={match.time_casa} crest={match.crest_casa} align="right" />
          <ScoreBig casa={match.placar_casa} fora={match.placar_fora} />
          <TeamSide nome={match.time_fora} crest={match.crest_fora} align="left" />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-white/10 pt-4">
          {p ? (
            <>
              <span className="font-sans text-sm text-cream/50">
                Seu palpite:{' '}
                <strong className="tabular text-cream">
                  {p.palpite_casa} — {p.palpite_fora}
                </strong>
              </span>
              {p.categoria && <PointsBadge code={p.categoria} pts={p.pontos_obtidos - (p.solitario ? 2 : 0)} />}
              {p.solitario && <PointsBadge code="★" pts={2} title="Bônus de placar solitário" />}
              <span
                className={`tabular font-display text-lg uppercase tracking-wide ${
                  pontuou ? 'text-pitch-vivid' : 'text-cream/40'
                }`}
              >
                +{p.pontos_obtidos} pts
              </span>
            </>
          ) : (
            <span className="font-sans text-cream/40">Você não palpitou neste jogo</span>
          )}
        </div>

        {stats && (
          <MatchStats stats={stats} timeCasa={match.time_casa} timeFora={match.time_fora} />
        )}

        {palpitesGalera && palpitesGalera.length > 0 && (
          <PalpitesGalera palpites={palpitesGalera} />
        )}
      </div>
    </div>
  )
}

export default FinishedMatchCard
