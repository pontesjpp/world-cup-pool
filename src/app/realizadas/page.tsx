import { SectionHeader } from '@/components/SectionHeader'
import { FinishedMatchCard, type FinishedMatch } from '@/components/FinishedMatchCard'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth'
import { computeMatchStats, type HistRow, type MatchStats } from '@/lib/matchStats'
import { rankFinalizado, type GaleraRow, type RankedPalpite } from '@/lib/palpitesGalera'

export const metadata = { title: 'Partidas Realizadas — Bolão da Galera' }

type PartidaRow = {
  id: string
  time_casa: string
  time_fora: string
  crest_casa: string | null
  crest_fora: string | null
  placar_casa: number | null
  placar_fora: number | null
  placar_casa_90: number | null
  placar_fora_90: number | null
  fase: string | null
  grupo: string | null
  data_jogo: string
}

type PalpiteRow = {
  partida_id: string
  palpite_casa: number
  palpite_fora: number
  pontos_obtidos: number
  categoria: string | null
  solitario: boolean
}

export default async function Realizadas() {
  const supabase = await createClient()
  const user = await getCachedUser()

  const [partidasRes, palpitesRes, histRes, galeraRes] = await Promise.all([
    supabase
      .from('partidas')
      .select(
        'id, time_casa, time_fora, crest_casa, crest_fora, placar_casa, placar_fora, placar_casa_90, placar_fora_90, fase, grupo, data_jogo',
      )
      .eq('status', 'FINISHED')
      .order('data_jogo', { ascending: false }),
    supabase
      .from('palpites')
      .select('partida_id, palpite_casa, palpite_fora, pontos_obtidos, categoria, solitario')
      .eq('user_id', user?.id ?? ''),
    // Histograma agregado da galera (a view só expõe jogos que já começaram).
    supabase.from('partida_palpite_hist').select('partida_id, palpite_casa, palpite_fora, qtd'),
    // Palpites nominais da galera (com os pontos somados em cada jogo).
    supabase
      .from('partida_palpites_galera')
      .select(
        'partida_id, user_id, nome, avatar_url, palpite_casa, palpite_fora, pontos_obtidos, categoria, solitario',
      ),
  ])

  const palpites = new Map<string, PalpiteRow>()
  for (const p of (palpitesRes.data ?? []) as PalpiteRow[]) palpites.set(p.partida_id, p)

  const histPorPartida = new Map<string, HistRow[]>()
  for (const h of (histRes.data ?? []) as (HistRow & { partida_id: string })[]) {
    const arr = histPorPartida.get(h.partida_id) ?? []
    arr.push({ palpite_casa: h.palpite_casa, palpite_fora: h.palpite_fora, qtd: h.qtd })
    histPorPartida.set(h.partida_id, arr)
  }

  // Palpites nominais da galera, agrupados e já rankeados por pontos (desc).
  const galeraPorPartida = new Map<string, GaleraRow[]>()
  for (const g of (galeraRes.data ?? []) as GaleraRow[]) {
    const arr = galeraPorPartida.get(g.partida_id) ?? []
    arr.push(g)
    galeraPorPartida.set(g.partida_id, arr)
  }
  const galeraRankPorPartida = new Map<string, RankedPalpite[]>()
  for (const [id, rows] of galeraPorPartida) {
    galeraRankPorPartida.set(id, rankFinalizado(rows, user?.id ?? null))
  }

  const toMatch = (p: PartidaRow): FinishedMatch => {
    const knockout = !p.grupo
    // Mata-mata pontua pelo placar de 90' (quando informado).
    const casa = knockout && p.placar_casa_90 != null ? p.placar_casa_90 : p.placar_casa
    const fora = knockout && p.placar_fora_90 != null ? p.placar_fora_90 : p.placar_fora
    const pal = palpites.get(p.id)
    return {
      id: p.id,
      time_casa: p.time_casa,
      time_fora: p.time_fora,
      crest_casa: p.crest_casa,
      crest_fora: p.crest_fora,
      placar_casa: casa,
      placar_fora: fora,
      fase: p.fase,
      grupo: p.grupo,
      data_jogo: p.data_jogo,
      palpite: pal
        ? {
            palpite_casa: pal.palpite_casa,
            palpite_fora: pal.palpite_fora,
            pontos_obtidos: pal.pontos_obtidos,
            categoria: pal.categoria,
            solitario: pal.solitario,
          }
        : null,
    }
  }

  const statsPorPartida = new Map<string, MatchStats>()
  const buildStats = (p: PartidaRow, casa: number | null, fora: number | null) => {
    const hist = histPorPartida.get(p.id)
    if (!hist) return
    const pal = palpites.get(p.id)
    statsPorPartida.set(
      p.id,
      computeMatchStats(
        hist,
        { casa, fora },
        pal ? { palpite_casa: pal.palpite_casa, palpite_fora: pal.palpite_fora } : null,
      ),
    )
  }

  const todas = (partidasRes.data ?? []) as PartidaRow[]
  const toMatchComStats = (p: PartidaRow): FinishedMatch => {
    const m = toMatch(p)
    buildStats(p, m.placar_casa, m.placar_fora)
    return m
  }
  const grupos = todas.filter((p) => p.grupo).map(toMatchComStats)
  const mata = todas.filter((p) => !p.grupo).map(toMatchComStats)

  const totalPts = [...palpites.values()].reduce((s, p) => s + (p.pontos_obtidos ?? 0), 0)

  return (
    <div>
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            O Retrospecto
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-7xl">
          Partidas <span className="text-brasil-gold">Realizadas</span>
        </h1>
        {todas.length > 0 && (
          <p className="mt-3 font-sans text-sm text-cream/55">
            <strong className="tabular text-brasil-gold">{todas.length}</strong> jogo(s) encerrado(s) ·{' '}
            <strong className="tabular text-pitch-vivid">{totalPts}</strong> pts seus em jogos
          </p>
        )}
      </div>

      {todas.length === 0 ? (
        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
          <span className="turf-layer" aria-hidden />
          <p className="relative z-10 font-sans text-cream/50">
            Nenhum jogo encerrado ainda. Quando a bola rolar, o resultado e o seu palpite aparecem
            aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {mata.length > 0 && (
            <section>
              <SectionHeader eyebrow="A Reta Final" title="Mata-mata" />
              <div className="space-y-5">
                {mata.map((m) => (
                  <FinishedMatchCard
                    key={m.id}
                    match={m}
                    stats={statsPorPartida.get(m.id)}
                    palpitesGalera={galeraRankPorPartida.get(m.id)}
                  />
                ))}
              </div>
            </section>
          )}
          {grupos.length > 0 && (
            <section>
              <SectionHeader eyebrow="A Largada" title="Fase de Grupos" />
              <div className="space-y-5">
                {grupos.map((m) => (
                  <FinishedMatchCard
                    key={m.id}
                    match={m}
                    stats={statsPorPartida.get(m.id)}
                    palpitesGalera={galeraRankPorPartida.get(m.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
