export type Partida = {
  id: string
  external_id: number
  time_casa: string
  time_fora: string
  crest_casa: string | null
  crest_fora: string | null
  data_jogo: string
  status: string
  placar_casa: number | null
  placar_fora: number | null
  fase: string | null
  grupo: string | null
}

export type Palpite = {
  palpite_casa: number
  palpite_fora: number
  pontos_obtidos: number
}

// ── Pré-Copa: classificação de grupos ──────────────────────────────────────

export type Team = { name: string; crest?: string | null }

// Um jogo da fase de grupos com o palpite de placar (null = ainda não preenchido).
export type GroupMatchScore = {
  home: string
  away: string
  homeGoals: number | null
  awayGoals: number | null
}

// Linha da classificação derivada de um grupo (4 por grupo).
export type StandingRow = {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
  position: number // 1..4
  // true quando a ordem final precisou do critério determinístico de desempate
  // (fair-play/sorteio não são deriváveis de placares — usamos rank/alfabético).
  tiebreakByLot: boolean
}

// ── Pré-Copa: chaveamento ───────────────────────────────────────────────────

export type BracketRound = 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD' | 'FINAL'

// Uma linha do template oficial do mata-mata (espelha public.bracket_template).
export type BracketSlot = {
  slot_key: string
  round: BracketRound
  match_no: number
  feeds_from_home: string | null
  feeds_from_away: string | null
  source_home: string | null
  source_away: string | null
  points_per_slot: number
}

// Rascunho completo da pré-copa mantido no cliente / autosave.
export type PreCopaDraft = {
  scores: Record<string, { casa: number | null; fora: number | null }> // por partida_id
  bracket: Record<string, string> // slot_key -> nome do time que avança
  finais: {
    campeao: string | null
    vice: string | null
    terceiro: string | null
    surpresa: string | null
  }
}
