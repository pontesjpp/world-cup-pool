import type { RankingRow } from '@/lib/homeStats'
import { SectionHeader } from '@/components/SectionHeader'

export { SectionHeader }

// Top 5 + usuário destacado. Sensação de tabela de torneio / pôster de leaderboard.
export default function RankingPreview({
  ranking,
  userId,
  position,
}: {
  ranking: RankingRow[]
  userId: string
  position: number | null
}) {
  const top = ranking.slice(0, 5)
  const me = position && position > 5 ? ranking[position - 1] : null

  return (
    <section className="mb-16">
      <SectionHeader eyebrow="A Disputa" title="Ranking" href="/ranking" cta="Ver tudo" />

      <div className="overflow-hidden rounded-[20px] border border-white/10 bg-surface">
        <div className="divide-y divide-white/5">
          {top.map((row, i) => (
            <Row
              key={row.user_id}
              pos={i + 1}
              row={row}
              isMe={row.user_id === userId}
            />
          ))}
        </div>

        {/* Usuário fora do top 5 */}
        {me && position && (
          <>
            <div className="flex items-center justify-center gap-1 bg-void/40 py-2 text-cream/25">
              <span className="h-1 w-1 rounded-full bg-cream/25" />
              <span className="h-1 w-1 rounded-full bg-cream/25" />
              <span className="h-1 w-1 rounded-full bg-cream/25" />
            </div>
            <div className="border-t border-brasil-gold/20">
              <Row pos={position} row={me} isMe />
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function Row({
  pos,
  row,
  isMe,
}: {
  pos: number
  row: RankingRow
  isMe: boolean
}) {
  return (
    <div
      className={`motion-cinema flex items-center gap-4 px-5 py-4 md:px-7 ${
        isMe ? 'bg-brasil-gold/10' : 'hover:bg-white/[0.03]'
      }`}
    >
      <span
        className={`tabular w-8 shrink-0 text-center font-display text-2xl ${
          pos === 1 ? 'text-brasil-gold' : isMe ? 'text-brasil-gold' : 'text-cream/30'
        }`}
      >
        {pos}
      </span>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-display text-base uppercase ${
          isMe
            ? 'border-brasil-gold/50 bg-brasil-gold/15 text-brasil-gold'
            : 'border-white/10 bg-void/60 text-cream/70'
        }`}
      >
        {row.nome.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg uppercase leading-none tracking-wide text-cream">
          {row.nome}
          {isMe && (
            <span className="ml-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brasil-gold">
              você
            </span>
          )}
        </p>
      </div>
      <div className="text-right">
        <span className="tabular font-display text-2xl text-cream md:text-3xl">
          {row.pontos}
        </span>
        <span className="ml-1 font-sans text-[11px] uppercase tracking-wide text-cream/40">
          pts
        </span>
      </div>
    </div>
  )
}

