// Pílula de pontuação por categoria (A–F / P / Solitário) — usada em Realizadas
// e no Ranking. Dourada quando pontuou, oca quando não.

export const CATEGORIA_LABEL: Record<string, string> = {
  A: 'Acertou o vencedor',
  B: 'Vencedor + gols do vencedor',
  C: 'Vencedor + gols do perdedor',
  D: 'Placar exato',
  E: 'Empate certo',
  F: 'Empate exato',
  P: 'Cravou gols de um time',
}

export function PointsBadge({
  code,
  pts,
  earned = true,
  title,
}: {
  code: string
  pts: number
  earned?: boolean
  title?: string
}) {
  return (
    <span
      title={title ?? CATEGORIA_LABEL[code]}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] ${
        earned
          ? 'border-brasil-gold/50 bg-brasil-gold/10 text-brasil-gold'
          : 'border-white/10 text-cream/35'
      }`}
    >
      <span className="font-display text-xs">{code}</span>
      <span className="tabular">+{pts}</span>
    </span>
  )
}

export default PointsBadge
