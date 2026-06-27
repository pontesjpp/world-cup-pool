import { MatchCard } from '@/components/MatchCard'
import { SectionHeader } from '@/components/SectionHeader'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth'
import { computeMatchStats, type HistRow, type MatchStats } from '@/lib/matchStats'
import {
  rankAoVivo,
  DEFAULT_SCORE_CFG,
  type GaleraRow,
  type LiveCfg,
  type RankedPalpite,
} from '@/lib/palpitesGalera'
import type { Partida, Palpite } from '@/lib/types'
import { selectAll } from '@/lib/supabase/selectAll'

export const metadata = {
  title: 'Próximos Jogos — Bolão da Galera',
}

export default async function ProximosJogos() {
  const supabase = await createClient()

  const user = await getCachedUser()

  const [partidasRes, palpitesRes, histRes, galeraRows, cfgRes] = await Promise.all([
    supabase.from('partidas').select('*').order('data_jogo', { ascending: true }),
    supabase
      .from('palpites')
      .select('partida_id, palpite_casa, palpite_fora, pontos_obtidos')
      .eq('user_id', user?.id ?? ''),
    // Histograma agregado da galera (a view só expõe jogos que já começaram).
    supabase.from('partida_palpite_hist').select('partida_id, palpite_casa, palpite_fora, qtd'),
    // Palpites nominais da galera (mesma view só expõe jogos que já começaram).
    selectAll<GaleraRow>((from, to) =>
      supabase
        .from('partida_palpites_galera')
        .select(
          'partida_id, user_id, nome, avatar_url, palpite_casa, palpite_fora, pontos_obtidos, categoria, solitario',
        )
        .order('partida_id')
        .order('user_id')
        .range(from, to),
    ),
    // Config de pontuação pra recalcular os pontos provisórios ao vivo.
    supabase
      .from('scoring_config')
      .select('pts_a, pts_b, pts_c, pts_d, pts_e, pts_f, pts_p, pts_solitario')
      .eq('id', 1)
      .single(),
  ])

  const palpitesPorPartida = new Map<string, Palpite>()
  for (const p of palpitesRes.data ?? []) {
    palpitesPorPartida.set(p.partida_id, {
      palpite_casa: p.palpite_casa,
      palpite_fora: p.palpite_fora,
      pontos_obtidos: p.pontos_obtidos,
    })
  }

  const histPorPartida = new Map<string, HistRow[]>()
  for (const h of (histRes.data ?? []) as (HistRow & { partida_id: string })[]) {
    const arr = histPorPartida.get(h.partida_id) ?? []
    arr.push({ palpite_casa: h.palpite_casa, palpite_fora: h.palpite_fora, qtd: h.qtd })
    histPorPartida.set(h.partida_id, arr)
  }

  // Stats da galera para um jogo em andamento (sem resultado final → sem cravadas).
  const statsDe = (id: string): MatchStats | null => {
    const hist = histPorPartida.get(id)
    if (!hist) return null
    const pal = palpitesPorPartida.get(id)
    return computeMatchStats(
      hist,
      { casa: null, fora: null },
      pal ? { palpite_casa: pal.palpite_casa, palpite_fora: pal.palpite_fora } : null,
    )
  }

  // Palpites nominais por partida + ranking ao vivo (pontos provisórios).
  const galeraPorPartida = new Map<string, GaleraRow[]>()
  for (const g of galeraRows) {
    const arr = galeraPorPartida.get(g.partida_id) ?? []
    arr.push(g)
    galeraPorPartida.set(g.partida_id, arr)
  }
  const cfg = (cfgRes.data as LiveCfg | null) ?? DEFAULT_SCORE_CFG
  const galeraAoVivoDe = (p: Partida): RankedPalpite[] => {
    const rows = galeraPorPartida.get(p.id)
    if (!rows) return []
    return rankAoVivo(rows, p.placar_casa ?? 0, p.placar_fora ?? 0, cfg, user?.id ?? null)
  }

  const lista = (partidasRes.data ?? []) as Partida[]
  const agora = Date.now()
  const BUFFER_MS = 5 * 60 * 1000 // palpite fecha 5 min antes do apito
  const isLocked = (p: Partida) =>
    new Date(p.data_jogo).getTime() - BUFFER_MS <= agora ||
    (p.status !== 'SCHEDULED' && p.status !== 'TIMED')
  // Já começou: apito rolou ou status ao vivo/pausado.
  const comecou = (p: Partida) =>
    new Date(p.data_jogo).getTime() <= agora || p.status === 'IN_PLAY' || p.status === 'PAUSED'

  // Em andamento: qualquer jogo (grupo ou mata) que já rolou e não encerrou.
  const emAndamento = lista.filter((p) => p.status !== 'FINISHED' && comecou(p))
  // Agendados: ainda não começaram. Grupo entra em modo leitura (palpite é na
  // Pré-Copa); mata-mata é editável jogo a jogo aqui.
  const agendados = lista.filter((p) => p.status !== 'FINISHED' && !comecou(p))
  // "Abertos pra cravar" conta só o mata-mata ainda editável.
  const abertos = agendados.filter((p) => !p.grupo && !isLocked(p)).length

  return (
    <div>
      {/* Cabeçalho editorial */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            A Tabela
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-7xl">
          Próximos <span className="text-brasil-gold">Jogos</span>
        </h1>
        {abertos > 0 && (
          <p className="mt-3 font-sans text-sm text-cream/55">
            <strong className="tabular text-brasil-gold">{abertos}</strong>{' '}
            {abertos === 1 ? 'jogo aberto' : 'jogos abertos'} pra cravar o placar.
          </p>
        )}
      </div>

      {agendados.length === 0 && emAndamento.length === 0 ? (
        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
          <span className="turf-layer" aria-hidden />
          <p className="relative z-10 font-sans text-cream/50">
            Nenhum jogo na tabela ainda. O administrador precisa sincronizar as
            partidas da Copa.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {emAndamento.length > 0 && (
            <section>
              <SectionHeader eyebrow="A bola já rolou" title="Em andamento" />
              <div className="space-y-5">
                {emAndamento.map((partida) => (
                  <MatchCard
                    key={partida.id}
                    partida={partida}
                    palpite={palpitesPorPartida.get(partida.id) ?? null}
                    locked
                    stats={statsDe(partida.id)}
                    palpitesGalera={galeraAoVivoDe(partida)}
                  />
                ))}
              </div>
            </section>
          )}

          {agendados.length > 0 && (
            <section>
              {emAndamento.length > 0 && <SectionHeader eyebrow="A Tabela" title="A seguir" />}
              <div className="space-y-5">
                {agendados.map((partida) => (
                  <MatchCard
                    key={partida.id}
                    partida={partida}
                    palpite={palpitesPorPartida.get(partida.id) ?? null}
                    locked={!partida.grupo && isLocked(partida)}
                    readOnly={!!partida.grupo}
                    // Estatísticas da galera liberam antes do apito (grupo: 1h; mata:
                    // na trava do palpite). A view partida_palpite_hist já controla a
                    // janela — statsDe devolve null enquanto o jogo não foi liberado.
                    stats={statsDe(partida.id)}
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
