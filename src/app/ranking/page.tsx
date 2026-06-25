import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

type RankingRow = {
  user_id: string
  nome: string
  pontos: number
  placares_exatos: number
  pts_partidas: number
  pts_grupos: number
  pts_chaveamento: number
  pts_bonus: number
}

type SnapshotRow = { user_id: string; posicao: number }

function Avatar({
  nome,
  url,
  sizeClass,
  borderClass,
  textClass,
  px,
}: {
  nome: string
  url: string | null
  sizeClass: string
  borderClass: string
  textClass: string
  px: number
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt={nome}
        width={px}
        height={px}
        className={`${sizeClass} shrink-0 rounded-full ${borderClass} object-cover`}
      />
    )
  }
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full ${borderClass} bg-void/60 font-display ${textClass} uppercase`}
    >
      {nome.charAt(0)}
    </div>
  )
}

function MovBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  if (delta === 0)
    return (
      <span className="tabular font-sans text-[11px] text-cream/25" title="Sem alteração">
        —
      </span>
    )
  if (delta > 0)
    return (
      <span className="tabular font-sans text-[11px] font-semibold text-pitch-vivid" title={`Subiu ${delta} posição`}>
        ▲{delta}
      </span>
    )
  return (
    <span className="tabular font-sans text-[11px] font-semibold text-flare" title={`Caiu ${Math.abs(delta)} posição`}>
      ▼{Math.abs(delta)}
    </span>
  )
}

function Breakdown({ row }: { row: RankingRow }) {
  if (row.pontos <= 0) return null
  const parts: [string, number][] = [
    ['Partidas', row.pts_partidas],
    ['Grupos', row.pts_grupos],
    ['Chave', row.pts_chaveamento],
    ['Bônus', row.pts_bonus],
  ]
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-sans text-[11px] text-cream/40">
      {parts.map(([label, v]) => (
        <span key={label}>
          {label} <strong className="tabular text-cream/70">{v}</strong>
        </span>
      ))}
    </p>
  )
}

export default async function Ranking() {
  const supabase = await createClient()
  const [{ data }, { data: profs }, { data: snaps }] = await Promise.all([
    supabase.from('ranking').select('*'),
    supabase.from('profiles').select('id, avatar_url'),
    supabase.from('ranking_snapshot').select('user_id, posicao'),
  ])
  const classificacao = (data ?? []) as RankingRow[]

  const avatarById = new Map<string, string | null>()
  for (const p of profs ?? []) {
    avatarById.set(p.id as string, (p.avatar_url as string | null) ?? null)
  }

  // delta = posição anterior − posição atual (positivo = subiu, negativo = caiu)
  const snapByUser = new Map<string, number>()
  for (const s of (snaps ?? []) as SnapshotRow[]) snapByUser.set(s.user_id, s.posicao)
  const deltaOf = (uid: string, posAtual: number): number | null => {
    const ant = snapByUser.get(uid)
    return ant != null ? ant - posAtual : null
  }

  const lider = classificacao[0]
  const resto = classificacao.slice(1)

  return (
    <div>
      {/* Cabeçalho editorial */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            A Galera
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-7xl">
          Classifica<span className="text-brasil-gold">ção</span>
        </h1>
      </div>

      {classificacao.length === 0 ? (
        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
          <span className="turf-layer" aria-hidden />
          <p className="relative z-10 font-sans text-cream/50">
            Ninguém pontuou ainda. Os pontos aparecem quando os jogos forem encerrados.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Banner do campeão: foto B&W do Pelé erguendo a taça ── */}
          {lider && (
            <div className="shadow-poster relative overflow-hidden rounded-[20px] border border-brasil-gold/30">
              <Image
                src="/icons/pele.jpg"
                alt="O líder"
                fill
                sizes="(max-width: 768px) 100vw, 1024px"
                className="object-cover object-[center_20%] opacity-40 saturate-0"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-void/30" />
              <div className="absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_50%,rgba(244,208,0,0.18),transparent_60%)]" />
              <span className="ghost-number -top-6 right-2 text-[11rem] text-brasil-gold opacity-[0.08]">
                1
              </span>

              <div className="relative z-10 flex items-center gap-5 p-6 md:p-8">
                <Avatar
                  nome={lider.nome}
                  url={avatarById.get(lider.user_id) ?? null}
                  sizeClass="h-16 w-16"
                  borderClass="border-2 border-brasil-gold"
                  textClass="text-2xl text-brasil-gold"
                  px={64}
                />
                <div className="min-w-0 flex-1">
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-brasil-gold">
                    🏆 Líder da Copa
                  </span>
                  <p className="truncate font-display text-3xl uppercase leading-none tracking-wide text-cream md:text-4xl">
                    {lider.nome}
                  </p>
                  <p className="mt-1 font-sans text-xs text-cream/50">
                    {lider.placares_exatos} placares exatos
                  </p>
                  <Breakdown row={lider} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-right">
                    <span className="tabular block font-display text-5xl leading-none tracking-score text-brasil-gold md:text-6xl">
                      {lider.pontos}
                    </span>
                    <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-cream/40">
                      pontos
                    </span>
                  </div>
                  <MovBadge delta={deltaOf(lider.user_id, 1)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Demais posições ── */}
          {resto.length > 0 && (
            <div className="overflow-hidden rounded-[20px] border border-white/10 bg-surface">
              <div className="divide-y divide-white/5">
                {resto.map((user, index) => {
                  const posicao = index + 2
                  return (
                    <div
                      key={user.user_id}
                      className="motion-cinema flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] md:px-7"
                    >
                      <span className="tabular w-8 shrink-0 text-center font-display text-2xl text-cream/30">
                        {posicao}
                      </span>
                      <Avatar
                        nome={user.nome}
                        url={avatarById.get(user.user_id) ?? null}
                        sizeClass="h-11 w-11"
                        borderClass="border border-white/10"
                        textClass="text-base text-cream/70"
                        px={44}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg uppercase leading-none tracking-wide text-cream">
                          {user.nome}
                        </p>
                        <p className="font-sans text-[11px] text-cream/40">
                          {user.placares_exatos} placares exatos
                        </p>
                        <Breakdown row={user} />
                      </div>
                      <div className="text-right">
                        <span className="tabular font-display text-2xl text-cream md:text-3xl">
                          {user.pontos}
                        </span>
                        <span className="ml-1 font-sans text-[11px] uppercase tracking-wide text-cream/40">
                          pts
                        </span>
                      </div>
                      <MovBadge delta={deltaOf(user.user_id, posicao)} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
