import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth'
import { PointsBadge } from '@/components/PointsBadge'
import { ExtratoExportButton } from '@/components/ExtratoExportButton'

export const metadata = { title: 'Meu Extrato — Bolão da Galera' }

// ── tipos ──────────────────────────────────────────────────────────────────

type PartidaRow = {
  id: string
  time_casa: string
  time_fora: string
  placar_casa: number | null
  placar_fora: number | null
  placar_casa_90: number | null
  placar_fora_90: number | null
  data_jogo: string
  grupo: string | null
  slot_key: string | null
}

type PalpiteRow = {
  partida_id: string
  pontos_obtidos: number
  categoria: string | null
  solitario: boolean
}

type ClassRow = {
  grupo: string
  pontos_obtidos: number | null
}

type Breakdown = {
  pts_bracket: number
  pts_finais: number
}

// ── helpers ────────────────────────────────────────────────────────────────

const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'] as const
type Round = (typeof ROUND_ORDER)[number]

const ROUND_LABEL: Record<Round, string> = {
  R32: 'Oitavas da Copa',
  R16: 'Oitavas de Final',
  QF: 'Quartas de Final',
  SF: 'Semifinais',
  THIRD: 'Disputa do 3º Lugar',
  FINAL: 'Final',
}

function getRound(slotKey: string): Round {
  const prefix = slotKey.split('-')[0] as Round
  return ROUND_ORDER.includes(prefix) ? prefix : 'FINAL'
}

function placarDisplay(partida: PartidaRow): string {
  const knockout = !partida.grupo
  const casa =
    knockout && partida.placar_casa_90 != null ? partida.placar_casa_90 : partida.placar_casa
  const fora =
    knockout && partida.placar_fora_90 != null ? partida.placar_fora_90 : partida.placar_fora
  if (casa == null || fora == null) return '–'
  return `${casa}×${fora}`
}

function grupoLabel(grupo: string): string {
  if (grupo.startsWith('Group ')) return `Grupo ${grupo.slice(6)}`
  return `Grupo ${grupo}`
}

// ── page ───────────────────────────────────────────────────────────────────

export default async function Extrato() {
  const supabase = await createClient()
  const user = await getCachedUser()

  const [partidasRes, palpitesRes, classRes, breakdownRes] = await Promise.all([
    supabase
      .from('partidas')
      .select(
        'id, time_casa, time_fora, placar_casa, placar_fora, placar_casa_90, placar_fora_90, data_jogo, grupo, slot_key',
      )
      .eq('status', 'FINISHED')
      .order('data_jogo', { ascending: true }),
    supabase
      .from('palpites')
      .select('partida_id, pontos_obtidos, categoria, solitario')
      .eq('user_id', user?.id ?? ''),
    supabase
      .from('palpite_classificacao')
      .select('grupo, pontos_obtidos')
      .eq('user_id', user?.id ?? ''),
    supabase
      .from('pontos_breakdown')
      .select('pts_bracket, pts_finais')
      .eq('user_id', user?.id ?? '')
      .maybeSingle(),
  ])

  const partidas = (partidasRes.data ?? []) as PartidaRow[]
  const palpiteMap = new Map<string, PalpiteRow>()
  for (const p of (palpitesRes.data ?? []) as PalpiteRow[]) palpiteMap.set(p.partida_id, p)

  // Pontos de classificação por grupo
  const ptsPorGrupo = new Map<string, number>()
  for (const r of (classRes.data ?? []) as ClassRow[]) {
    const prev = ptsPorGrupo.get(r.grupo) ?? 0
    ptsPorGrupo.set(r.grupo, prev + (r.pontos_obtidos ?? 0))
  }
  const gruposComPts = [...ptsPorGrupo.entries()].sort(([a], [b]) => a.localeCompare(b))

  // Partidas com palpite
  const comPalpite = partidas.filter((p) => palpiteMap.has(p.id))
  const grupos = comPalpite.filter((p) => p.grupo)
  const mata = comPalpite.filter((p) => !p.grupo && p.slot_key)

  // Subtotais por rodada mata-mata
  const ptsPorRodada = new Map<Round, number>()
  for (const p of mata) {
    const pal = palpiteMap.get(p.id)!
    const round = getRound(p.slot_key!)
    ptsPorRodada.set(round, (ptsPorRodada.get(round) ?? 0) + (pal.pontos_obtidos ?? 0))
  }

  const totalGruposJogos = grupos.reduce(
    (s, p) => s + (palpiteMap.get(p.id)?.pontos_obtidos ?? 0),
    0,
  )
  const totalClassificacao = gruposComPts.reduce((s, [, v]) => s + v, 0)
  const totalMataJogos = mata.reduce(
    (s, p) => s + (palpiteMap.get(p.id)?.pontos_obtidos ?? 0),
    0,
  )
  const breakdown = breakdownRes.data as Breakdown | null
  const ptsBracket = breakdown?.pts_bracket ?? 0
  const ptsFinais = breakdown?.pts_finais ?? 0
  const totalGeral =
    totalGruposJogos + totalClassificacao + totalMataJogos + ptsBracket + ptsFinais

  return (
    <div>
      {/* header editorial */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            Seus Pontos
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-7xl">
          Meu <span className="text-brasil-gold">Extrato</span>
        </h1>
        {comPalpite.length > 0 && (
          <p className="mt-3 font-sans text-sm text-cream/55">
            <strong className="tabular text-brasil-gold">{totalGeral}</strong> pontos no total ·{' '}
            <strong className="tabular text-cream/70">{comPalpite.length}</strong> jogo(s) com palpite
          </p>
        )}
      </div>

      {comPalpite.length === 0 ? (
        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
          <p className="font-sans text-cream/50">
            Nenhum jogo encerrado com palpite ainda. Os pontos aparecem aqui assim que os jogos
            forem concluídos.
          </p>
        </div>
      ) : (
        <div id="extrato-content" className="space-y-8">
          {/* ── Lista de jogos ─────────────────────────────────────────────── */}
          {grupos.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-[2px] w-6 bg-brasil-gold/50" />
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-brasil-gold/70">
                  Fase de Grupos — jogos
                </span>
              </div>
              <div className="overflow-hidden rounded-[20px] border border-white/10 bg-surface">
                <div className="divide-y divide-white/5">
                  {grupos.map((p) => {
                    const pal = palpiteMap.get(p.id)!
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-4 px-5 py-3 md:px-6"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-display text-sm uppercase tracking-wide text-cream/80">
                            {p.time_casa}
                          </span>
                          <span className="mx-2 font-sans text-xs text-cream/30">
                            {placarDisplay(p)}
                          </span>
                          <span className="font-display text-sm uppercase tracking-wide text-cream/80">
                            {p.time_fora}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {pal.categoria && (
                            <PointsBadge
                              code={pal.categoria}
                              pts={pal.pontos_obtidos}
                              earned={pal.pontos_obtidos > 0}
                            />
                          )}
                          {pal.solitario && (
                            <span className="font-sans text-[11px] text-brasil-gold/70">+2★</span>
                          )}
                          {!pal.categoria && (
                            <span className="tabular font-sans text-sm text-cream/30">0 pts</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {mata.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-[2px] w-6 bg-brasil-gold/50" />
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-brasil-gold/70">
                  Mata-mata — jogos
                </span>
              </div>
              <div className="overflow-hidden rounded-[20px] border border-white/10 bg-surface">
                <div className="divide-y divide-white/5">
                  {mata.map((p) => {
                    const pal = palpiteMap.get(p.id)!
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-4 px-5 py-3 md:px-6"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-sans text-[10px] uppercase tracking-wide text-cream/30 mr-2">
                            {ROUND_LABEL[getRound(p.slot_key!)]}
                          </span>
                          <span className="font-display text-sm uppercase tracking-wide text-cream/80">
                            {p.time_casa}
                          </span>
                          <span className="mx-2 font-sans text-xs text-cream/30">
                            {placarDisplay(p)}
                          </span>
                          <span className="font-display text-sm uppercase tracking-wide text-cream/80">
                            {p.time_fora}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {pal.categoria && (
                            <PointsBadge
                              code={pal.categoria}
                              pts={pal.pontos_obtidos}
                              earned={pal.pontos_obtidos > 0}
                            />
                          )}
                          {pal.solitario && (
                            <span className="font-sans text-[11px] text-brasil-gold/70">+2★</span>
                          )}
                          {!pal.categoria && (
                            <span className="tabular font-sans text-sm text-cream/30">0 pts</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ── Resumo Final ──────────────────────────────────────────────── */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-[2px] w-6 bg-brasil-gold/50" />
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-brasil-gold/70">
                Resumo
              </span>
            </div>
            <div className="overflow-hidden rounded-[20px] border border-white/10 bg-surface divide-y divide-white/5">

              {/* Classificação de grupos */}
              {gruposComPts.length > 0 && (
                <div className="px-5 py-4 md:px-6">
                  <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-cream/40">
                    Classificação de Grupos
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {gruposComPts.map(([grupo, pts]) => (
                      <div key={grupo} className="flex items-baseline gap-1.5">
                        <span className="font-sans text-xs text-cream/50">{grupoLabel(grupo)}</span>
                        <span className="tabular font-display text-base text-cream">
                          {pts}
                        </span>
                        <span className="font-sans text-[10px] text-cream/30">pts</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 font-sans text-xs text-cream/40">
                    Subtotal:{' '}
                    <strong className="tabular text-cream/70">{totalClassificacao} pts</strong>
                  </p>
                </div>
              )}

              {/* Mata-mata por rodada */}
              {ptsPorRodada.size > 0 && (
                <div className="px-5 py-4 md:px-6">
                  <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-cream/40">
                    Mata-mata por Fase
                  </p>
                  <div className="space-y-1.5">
                    {ROUND_ORDER.filter((r) => ptsPorRodada.has(r)).map((round) => (
                      <div key={round} className="flex items-baseline justify-between">
                        <span className="font-sans text-xs text-cream/50">{ROUND_LABEL[round]}</span>
                        <span className="tabular font-display text-base text-cream">
                          {ptsPorRodada.get(round)} pts
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 font-sans text-xs text-cream/40">
                    Subtotal:{' '}
                    <strong className="tabular text-cream/70">{totalMataJogos} pts</strong>
                  </p>
                </div>
              )}

              {/* Pré-copa */}
              {(ptsBracket > 0 || ptsFinais > 0) && (
                <div className="px-5 py-4 md:px-6">
                  <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-cream/40">
                    Pré-Copa
                  </p>
                  <div className="space-y-1.5">
                    {ptsBracket > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="font-sans text-xs text-cream/50">Chaveamento</span>
                        <span className="tabular font-display text-base text-cream">
                          {ptsBracket} pts
                        </span>
                      </div>
                    )}
                    {ptsFinais > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="font-sans text-xs text-cream/50">Bônus finais</span>
                        <span className="tabular font-display text-base text-cream">
                          {ptsFinais} pts
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Total geral */}
              <div className="flex items-baseline justify-between px-5 py-4 md:px-6">
                <span className="font-display text-lg uppercase tracking-wide text-cream">
                  Total Geral
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="tabular font-display text-3xl text-brasil-gold">
                    {totalGeral}
                  </span>
                  <span className="font-sans text-xs uppercase tracking-wide text-cream/40">
                    pontos
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Exportar ─────────────────────────────────────────────────── */}
          <div className="flex justify-end">
            <ExtratoExportButton />
          </div>
        </div>
      )}
    </div>
  )
}
