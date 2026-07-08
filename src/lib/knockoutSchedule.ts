// Calendário fixo do mata-mata (fuso Brasília, -03:00). Usado por
// salvarBracketReal para que um jogo criado no bracket já nasça com a
// data/hora corretas, em vez do placeholder new Date() ("agora").
// Chave = slot_key do bracket_template.
export const KNOCKOUT_SCHEDULE: Record<string, string> = {
  'QF-1': '2026-07-09T17:00:00-03:00', // J97
  'QF-2': '2026-07-10T16:00:00-03:00', // J98
  'QF-3': '2026-07-11T18:00:00-03:00', // J99
  'QF-4': '2026-07-11T22:00:00-03:00', // J100
  'SF-1': '2026-07-14T16:00:00-03:00', // J101
  'SF-2': '2026-07-15T16:00:00-03:00', // J102
  THIRD: '2026-07-18T18:00:00-03:00', // J103
  FINAL: '2026-07-19T16:00:00-03:00', // J104
}

// Rótulo de fase em PT — exibido cru no MatchCard (partida.fase).
export const FASE_LABEL: Record<string, string> = {
  R16: 'Oitavas de final',
  QF: 'Quartas de final',
  SF: 'Semifinal',
  THIRD: 'Disputa de 3º lugar',
  FINAL: 'Final',
}
