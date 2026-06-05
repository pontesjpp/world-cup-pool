// Anel de progresso editorial (SVG puro, sem libs). Número gigante no centro.
export default function StatRing({
  pct,
  label,
  size = 92,
}: {
  pct: number
  label: string
  size?: number
}) {
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = c - (clamped / 100) * c

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(246,241,232,0.12)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#F4D000"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="tabular absolute inset-0 flex items-center justify-center font-display text-2xl text-cream">
          {clamped}%
        </span>
      </div>
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/45">
        {label}
      </span>
    </div>
  )
}
