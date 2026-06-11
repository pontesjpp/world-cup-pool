'use client'

import { StandingsTable } from './StandingsTable'
import { PreCopaMatchRow } from './PreCopaMatchRow'
import { StepNav } from './StepNav'
import type { StandingRow, Team } from '@/lib/types'
import type { WizardGroup } from './types'

function formatData(iso: string | null): string | undefined {
  if (!iso) return undefined
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

export function GroupStep({
  group,
  index,
  total,
  rows,
  teamsMeta,
  scores,
  onScore,
  disabled,
  onPrev,
  onNext,
  nextLabel,
}: {
  group: WizardGroup
  index: number
  total: number
  rows: StandingRow[]
  teamsMeta: Record<string, Team>
  scores: Record<string, { casa: number | null; fora: number | null }>
  onScore: (partidaId: string, casa: number | null, fora: number | null) => void
  disabled?: boolean
  onPrev?: () => void
  onNext: () => void
  nextLabel: string
}) {
  const filled = group.matches.filter((m) => {
    const s = scores[m.id]
    return s && s.casa != null && s.fora != null
  }).length

  return (
    <div>
      <div className="relative mb-5">
        <span className="ghost-number -right-2 -top-10 text-[10rem] md:text-[13rem]">
          {group.letter}
        </span>
        <div className="relative">
          <div className="mb-2 flex items-center gap-3">
            <span className="h-[2px] w-8 bg-brasil-gold" />
            <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
              Fase de Grupos
            </span>
          </div>
          <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-6xl">
            Grupo <span className="text-brasil-gold">{group.letter}</span>
          </h1>
        </div>
      </div>

      {/* Classificação ao vivo (sticky) */}
      <div className="sticky top-2 z-20 mb-5">
        <StandingsTable rows={rows} teamsMeta={teamsMeta} />
      </div>

      {/* Jogos do grupo */}
      <div className="space-y-3">
        {group.matches.map((m) => {
          const s = scores[m.id] ?? { casa: null, fora: null }
          return (
            <PreCopaMatchRow
              key={m.id}
              home={m.home}
              away={m.away}
              casa={s.casa}
              fora={s.fora}
              data={formatData(m.date)}
              disabled={disabled}
              onChange={(casa, fora) => onScore(m.id, casa, fora)}
            />
          )
        })}
      </div>

      <StepNav
        onPrev={onPrev}
        onNext={onNext}
        prevLabel="← Grupo anterior"
        nextLabel={nextLabel}
        center={
          <span className="font-sans text-xs text-cream/50">
            Grupo <strong className="tabular text-cream">{index + 1}</strong>/{total} ·{' '}
            <strong className={`tabular ${filled === 6 ? 'text-pitch-vivid' : 'text-brasil-gold'}`}>
              {filled}
            </strong>
            /6 placares
          </span>
        }
      />
    </div>
  )
}

export default GroupStep
