// Ranking nominal de palpites de uma partida que já começou — alimentado pela
// view partida_palpites_galera. Em jogo FINISHED usa os pontos persistidos
// (já com o bônus solitário); em jogo ao vivo recalcula pontos provisórios
// contra o placar parcial. Sempre devolve em ordem decrescente de pontos.

import { scoreMatch, type ScoreCfg } from './scoring'

// Linha crua da view partida_palpites_galera (só desta partida).
export type GaleraRow = {
  partida_id: string
  user_id: string
  nome: string
  avatar_url: string | null
  palpite_casa: number
  palpite_fora: number
  pontos_obtidos: number
  categoria: string | null
  solitario: boolean
}

export type RankedPalpite = {
  user_id: string
  nome: string
  avatar_url: string | null
  palpite_casa: number
  palpite_fora: number
  pontos: number
  categoria: string | null
  solitario: boolean
  isMe: boolean
}

export type LiveCfg = ScoreCfg & { pts_solitario: number }

// Defaults do scoring_config (schema.sql) — fallback se a config não vier.
export const DEFAULT_SCORE_CFG: LiveCfg = {
  pts_a: 3,
  pts_b: 4,
  pts_c: 4,
  pts_d: 5,
  pts_e: 3,
  pts_f: 5,
  pts_p: 1,
  pts_solitario: 2,
}

// Mais pontos primeiro; desempate alfabético estável.
function ordenar(a: RankedPalpite, b: RankedPalpite) {
  return b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR')
}

// Jogo encerrado: usa os pontos já gravados (incluem o bônus solitário).
export function rankFinalizado(rows: GaleraRow[], meId: string | null): RankedPalpite[] {
  return rows
    .map((r) => ({
      user_id: r.user_id,
      nome: r.nome,
      avatar_url: r.avatar_url,
      palpite_casa: r.palpite_casa,
      palpite_fora: r.palpite_fora,
      pontos: r.pontos_obtidos,
      categoria: r.categoria,
      solitario: r.solitario,
      isMe: r.user_id === meId,
    }))
    .sort(ordenar)
}

// Jogo em andamento: recalcula pontos provisórios contra o placar parcial.
export function rankAoVivo(
  rows: GaleraRow[],
  casa: number,
  fora: number,
  cfg: LiveCfg,
  meId: string | null,
): RankedPalpite[] {
  const scored: RankedPalpite[] = rows.map((r) => {
    const s = scoreMatch(r.palpite_casa, r.palpite_fora, casa, fora, cfg)
    return {
      user_id: r.user_id,
      nome: r.nome,
      avatar_url: r.avatar_url,
      palpite_casa: r.palpite_casa,
      palpite_fora: r.palpite_fora,
      pontos: s.pts,
      categoria: s.categoria,
      solitario: false,
      isMe: r.user_id === meId,
    }
  })
  // Bônus solitário provisório: se exatamente 1 cravou D/F contra o placar atual.
  const df = scored.filter((s) => s.categoria === 'D' || s.categoria === 'F')
  if (df.length === 1) {
    df[0].solitario = true
    df[0].pontos += cfg.pts_solitario
  }
  return scored.sort(ordenar)
}
