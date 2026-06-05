'use client'

import { useMemo, useState } from 'react'
import { TeamPickButton } from './TeamPickButton'
import { StepNav } from './StepNav'
import type { Team } from '@/lib/types'

function TrophyCard({
  label,
  pts,
  team,
  teamsMeta,
  accent,
}: {
  label: string
  pts: number
  team: string | null
  teamsMeta: Record<string, Team>
  accent?: boolean
}) {
  const meta = team ? (teamsMeta[team] ?? { name: team, crest: null }) : null
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 ${
        accent ? 'border-brasil-gold/40 bg-brasil-gold/[0.06]' : 'border-white/10 bg-surface'
      }`}
    >
      <span className="turf-layer" aria-hidden />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className={`font-sans text-[10px] font-semibold uppercase tracking-[0.2em] ${accent ? 'text-brasil-gold' : 'text-cream/45'}`}>
            {label}
          </span>
          <span className="font-sans text-[10px] uppercase tracking-[0.15em] text-cream/35">+{pts} pts</span>
        </div>
        <p className={`mt-2 truncate font-display text-2xl uppercase tracking-wide ${meta ? 'text-cream' : 'text-cream/30'}`}>
          {meta?.name ?? 'A definir'}
        </p>
      </div>
    </div>
  )
}

export function FinaisStep({
  campeao,
  vice,
  terceiro,
  surpresa,
  surpresaTeams,
  teamsMeta,
  onSurpresa,
  disabled,
  onPrev,
  onNext,
  onEditChave,
}: {
  campeao: string | null
  vice: string | null
  terceiro: string | null
  surpresa: string | null
  surpresaTeams: Team[]
  teamsMeta: Record<string, Team>
  onSurpresa: (team: string) => void
  disabled?: boolean
  onPrev: () => void
  onNext: () => void
  onEditChave: () => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = t ? surpresaTeams.filter((s) => s.name.toLowerCase().includes(t)) : surpresaTeams
    return list.slice(0, 60)
  }, [q, surpresaTeams])

  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            Pódio & Surpresa
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-6xl">
          As <span className="text-brasil-gold">Finais</span>
        </h1>
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <TrophyCard label="Campeão" pts={23} team={campeao} teamsMeta={teamsMeta} accent />
        <TrophyCard label="Vice" pts={18} team={vice} teamsMeta={teamsMeta} />
        <TrophyCard label="3º lugar" pts={15} team={terceiro} teamsMeta={teamsMeta} />
      </div>
      <p className="mb-8 font-sans text-xs text-cream/45">
        Campeão, vice e 3º vêm do seu chaveamento.{' '}
        <button type="button" onClick={onEditChave} className="text-brasil-gold hover:underline">
          Editar chave
        </button>
      </p>

      {/* Surpresa */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/45">
            Seleção surpresa
          </span>
          <span className="font-sans text-[10px] uppercase tracking-[0.15em] text-cream/35">+15 pts</span>
        </div>
        <p className="mb-3 font-sans text-xs text-cream/45">
          Seleção fora do top-20 da FIFA que for mais longe no mata-mata.
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar seleção…"
          disabled={disabled}
          className="mb-3 w-full rounded-lg border border-white/15 bg-void/70 px-3 py-2 font-sans text-sm text-cream outline-none focus:border-brasil-gold disabled:opacity-50"
        />
        <div className="grid max-h-72 gap-1.5 overflow-y-auto md:grid-cols-2">
          {filtered.map((t) => (
            <TeamPickButton
              key={t.name}
              team={t}
              selected={surpresa === t.name}
              disabled={disabled}
              onClick={() => onSurpresa(t.name)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-4 text-center font-sans text-sm text-cream/40">
              Nenhuma seleção elegível encontrada.
            </p>
          )}
        </div>
      </div>

      <StepNav onPrev={onPrev} onNext={onNext} prevLabel="← Chave" nextLabel="Revisar →" />
    </div>
  )
}

export default FinaisStep
