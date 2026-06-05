// Pontuação PURA por partida (hierárquica) — regulamento §3.1.
// Em cada jogo vale apenas a MELHOR categoria atingida. O bônus solitário (+2)
// é aplicado fora daqui (precisa dos palpites de todos os participantes).

export type ScoreCfg = {
  pts_a: number // acertou o vencedor
  pts_b: number // vencedor + gols do vencedor
  pts_c: number // vencedor + gols do perdedor
  pts_d: number // placar exato (com vencedor)
  pts_e: number // empate certo (placar errado)
  pts_f: number // empate exato
  pts_p: number // consolação: cravou os gols de um dos times
}

export type MatchScore = { categoria: string | null; pts: number }

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0
}

/**
 * Pontua um palpite contra o resultado real (gols casa/fora) aplicando a
 * hierarquia A–F + P. Retorna a categoria vencedora e os pontos base.
 *
 * @param gc/gf  palpite (casa/fora)
 * @param pc/pf  resultado real (casa/fora) — 90' no mata-mata
 */
export function scoreMatch(
  gc: number,
  gf: number,
  pc: number,
  pf: number,
  cfg: ScoreCfg,
): MatchScore {
  const exact = gc === pc && gf === pf
  const predDraw = gc === gf
  const actualDraw = pc === pf

  if (exact) {
    return actualDraw ? { categoria: 'F', pts: cfg.pts_f } : { categoria: 'D', pts: cfg.pts_d }
  }

  // Empate palpitado e empate real (placar diferente) → E.
  if (predDraw && actualDraw) {
    return { categoria: 'E', pts: cfg.pts_e }
  }

  // Vencedor correto (ambos não-empate, mesmo lado vencendo) → A/B/C.
  if (!predDraw && !actualDraw && sign(gc - gf) === sign(pc - pf)) {
    const predHomeWins = gc > gf
    const winnerPredGoals = predHomeWins ? gc : gf
    const winnerActGoals = predHomeWins ? pc : pf
    const loserPredGoals = predHomeWins ? gf : gc
    const loserActGoals = predHomeWins ? pf : pc
    if (winnerPredGoals === winnerActGoals) return { categoria: 'B', pts: cfg.pts_b }
    if (loserPredGoals === loserActGoals) return { categoria: 'C', pts: cfg.pts_c }
    return { categoria: 'A', pts: cfg.pts_a }
  }

  // Errou o vencedor/empate, mas cravou os gols de um dos times → P.
  if (gc === pc || gf === pf) return { categoria: 'P', pts: cfg.pts_p }

  return { categoria: null, pts: 0 }
}
