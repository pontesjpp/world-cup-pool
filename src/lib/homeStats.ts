import type { Partida, Palpite } from './types'

export type RankingRow = {
  user_id: string
  nome: string
  pontos: number
  placares_exatos: number
}

export type HomeStats = {
  totalMatches: number
  predictedCount: number
  completionPct: number
  points: number
  position: number | null
  totalPlayers: number
  exactScores: number
  accuracyPct: number
  streak: number
  finishedPredicted: number
  /** Resultado dos jogos encerrados mais recentes (true = pontuou). Mais recente primeiro. */
  form: boolean[]
  /** Resumo dos últimos jogos encerrados que o usuário palpitou. */
  recent: { points: number; exact: number; correct: number; count: number } | null
}

const FINISHED = 'FINISHED'

function isExact(p: Partida, g: Palpite) {
  return p.placar_casa === g.palpite_casa && p.placar_fora === g.palpite_fora
}

/** Calcula todas as métricas da home a partir dos dados já buscados. */
export function computeHomeStats(args: {
  partidas: Partida[]
  palpitesByPartida: Map<string, Palpite>
  ranking: RankingRow[]
  userId: string
}): HomeStats {
  const { partidas, palpitesByPartida, ranking, userId } = args

  const totalMatches = partidas.length
  const predictedCount = palpitesByPartida.size
  const completionPct =
    totalMatches > 0 ? Math.round((predictedCount / totalMatches) * 100) : 0

  // Posição/pontos vêm da view de ranking (fonte única da verdade)
  const idx = ranking.findIndex((r) => r.user_id === userId)
  const me = idx >= 0 ? ranking[idx] : null
  const position = idx >= 0 ? idx + 1 : null
  const points = me?.pontos ?? 0
  const exactScores = me?.placares_exatos ?? 0
  const totalPlayers = ranking.length

  // Jogos encerrados que o usuário palpitou, em ordem cronológica
  const finishedPredicted = partidas
    .filter((p) => p.status === FINISHED && palpitesByPartida.has(p.id))
    .sort((a, b) => +new Date(a.data_jogo) - +new Date(b.data_jogo))

  let correctCount = 0
  for (const p of finishedPredicted) {
    if ((palpitesByPartida.get(p.id)?.pontos_obtidos ?? 0) > 0) correctCount++
  }
  const accuracyPct =
    finishedPredicted.length > 0
      ? Math.round((correctCount / finishedPredicted.length) * 100)
      : 0

  // Sequência atual: acertos consecutivos a partir do jogo mais recente
  let streak = 0
  for (let i = finishedPredicted.length - 1; i >= 0; i--) {
    const g = palpitesByPartida.get(finishedPredicted[i].id)
    if ((g?.pontos_obtidos ?? 0) > 0) streak++
    else break
  }

  // Forma: últimos 5 encerrados, mais recente primeiro
  const lastFive = [...finishedPredicted].reverse().slice(0, 5)
  const form = lastFive.map(
    (p) => (palpitesByPartida.get(p.id)?.pontos_obtidos ?? 0) > 0
  )

  // Resumo dos últimos jogos
  let recent: HomeStats['recent'] = null
  if (lastFive.length > 0) {
    let pts = 0
    let exact = 0
    let correct = 0
    for (const p of lastFive) {
      const g = palpitesByPartida.get(p.id)!
      pts += g.pontos_obtidos
      if (g.pontos_obtidos > 0) correct++
      if (isExact(p, g)) exact++
    }
    recent = { points: pts, exact, correct, count: lastFive.length }
  }

  return {
    totalMatches,
    predictedCount,
    completionPct,
    points,
    position,
    totalPlayers,
    exactScores,
    accuracyPct,
    streak,
    finishedPredicted: finishedPredicted.length,
    form,
    recent,
  }
}
