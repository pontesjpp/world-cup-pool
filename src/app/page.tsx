import Hero from '@/components/Hero'
import Footer from '@/components/Footer'
import PreCopaCallout from '@/components/PreCopaCallout'
import QuickStatsStrip from '@/components/home/QuickStatsStrip'
import NextGamesPreview from '@/components/home/NextGamesPreview'
import RankingPreview from '@/components/home/RankingPreview'
import RecentForm from '@/components/home/RecentForm'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser, getCurrentProfile } from '@/lib/auth'
import { computeHomeStats, type RankingRow } from '@/lib/homeStats'
import type { Partida, Palpite } from '@/lib/types'

export default async function Home() {
  const supabase = await createClient()

  const user = await getCachedUser()
  const userId = user?.id ?? ''

  // Busca tudo em paralelo
  const [profile, partidasRes, palpitesRes, rankingRes, profsRes] = await Promise.all([
    getCurrentProfile(),
    supabase.from('partidas').select('*').order('data_jogo', { ascending: true }),
    supabase
      .from('palpites')
      .select('partida_id, palpite_casa, palpite_fora, pontos_obtidos')
      .eq('user_id', userId),
    supabase.from('ranking').select('*'),
    // Avatares vêm da tabela profiles (a view ranking não traz avatar_url).
    supabase.from('profiles').select('id, avatar_url'),
  ])

  const lista = (partidasRes.data ?? []) as Partida[]
  const ranking = (rankingRes.data ?? []) as RankingRow[]

  const avatarById = new Map<string, string | null>()
  for (const p of profsRes.data ?? []) {
    avatarById.set(p.id as string, (p.avatar_url as string | null) ?? null)
  }

  const palpitesPorPartida = new Map<string, Palpite>()
  for (const p of palpitesRes.data ?? []) {
    palpitesPorPartida.set(p.partida_id, {
      palpite_casa: p.palpite_casa,
      palpite_fora: p.palpite_fora,
      pontos_obtidos: p.pontos_obtidos,
    })
  }

  const stats = computeHomeStats({
    partidas: lista,
    palpitesByPartida: palpitesPorPartida,
    ranking,
    userId,
  })

  const agora = Date.now()
  const isLocked = (p: Partida) =>
    new Date(p.data_jogo).getTime() <= agora ||
    (p.status !== 'SCHEDULED' && p.status !== 'TIMED')

  const jogosAbertos = lista.filter((p) => !isLocked(p)).length
  const proximos3 = lista.filter((p) => p.status !== 'FINISHED').slice(0, 3)
  const nome = profile?.nome ?? 'Craque'

  return (
    <>
      <Hero nome={nome} stats={stats} jogosAbertos={jogosAbertos} />

      <PreCopaCallout />

      <QuickStatsStrip stats={stats} />

      {/* ── Próximos jogos (prévia) ── */}
      {proximos3.length > 0 && (
        <NextGamesPreview games={proximos3} palpitesByPartida={palpitesPorPartida} />
      )}

      {/* ── Ranking preview ── */}
      {ranking.length > 0 && (
        <RankingPreview
          ranking={ranking}
          userId={userId}
          position={stats.position}
          avatarById={avatarById}
        />
      )}

      {/* ── Performance recente ── */}
      <RecentForm stats={stats} />

      <Footer />
    </>
  )
}
