import { MatchCard } from '@/components/MatchCard'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth'
import type { Partida, Palpite } from '@/lib/types'

export const metadata = {
  title: 'Próximos Jogos — Bolão da Galera',
}

export default async function ProximosJogos() {
  const supabase = await createClient()

  const user = await getCachedUser()

  const [partidasRes, palpitesRes] = await Promise.all([
    supabase.from('partidas').select('*').order('data_jogo', { ascending: true }),
    supabase
      .from('palpites')
      .select('partida_id, palpite_casa, palpite_fora, pontos_obtidos')
      .eq('user_id', user?.id ?? ''),
  ])

  const palpitesPorPartida = new Map<string, Palpite>()
  for (const p of palpitesRes.data ?? []) {
    palpitesPorPartida.set(p.partida_id, {
      palpite_casa: p.palpite_casa,
      palpite_fora: p.palpite_fora,
      pontos_obtidos: p.pontos_obtidos,
    })
  }

  const lista = (partidasRes.data ?? []) as Partida[]
  const agora = Date.now()
  const BUFFER_MS = 5 * 60 * 1000 // palpite fecha 5 min antes do apito
  const isLocked = (p: Partida) =>
    new Date(p.data_jogo).getTime() - BUFFER_MS <= agora ||
    (p.status !== 'SCHEDULED' && p.status !== 'TIMED')

  // Fase de grupos é palpitada na Pré-Copa; aqui só o mata-mata (jogo a jogo).
  const proximos = lista.filter((p) => p.status !== 'FINISHED' && !p.grupo)
  const abertos = proximos.filter((p) => !isLocked(p)).length

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
        {proximos.length > 0 && (
          <p className="mt-3 font-sans text-sm text-cream/55">
            <strong className="tabular text-brasil-gold">{abertos}</strong>{' '}
            {abertos === 1 ? 'jogo aberto' : 'jogos abertos'} pra cravar o placar.
          </p>
        )}
      </div>

      {proximos.length === 0 ? (
        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-surface p-12 text-center">
          <span className="turf-layer" aria-hidden />
          <p className="relative z-10 font-sans text-cream/50">
            Nenhum jogo na tabela ainda. O administrador precisa sincronizar as
            partidas da Copa.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {proximos.map((partida) => (
            <MatchCard
              key={partida.id}
              partida={partida}
              palpite={palpitesPorPartida.get(partida.id) ?? null}
              locked={isLocked(partida)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
