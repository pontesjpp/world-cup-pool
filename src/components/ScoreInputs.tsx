'use client'

// Campos de placar reutilizáveis — o "tijolo" visual de todo input de palpite.
// Dois modos:
//  - FORM (MatchCard): passe `casaName`/`foraName` + `defaultCasa`/`defaultFora`
//    (inputs não-controlados, enviados via FormData da server action).
//  - CONTROLADO (wizard pré-copa): passe `casa`/`fora` + `onChange`.

type Size = 'lg' | 'md'

const FIELD: Record<Size, string> = {
  lg: 'tabular h-[68px] w-[58px] rounded-xl border-2 border-white/15 bg-void/70 p-0 text-center font-display text-5xl leading-none text-cream outline-none transition-colors focus:border-brasil-gold focus:bg-void [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50',
  md: 'tabular h-[52px] w-[46px] rounded-lg border-2 border-white/15 bg-void/70 p-0 text-center font-display text-3xl leading-none text-cream outline-none transition-colors focus:border-brasil-gold focus:bg-void [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50',
}

function parse(v: string): number | null {
  if (v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : null
}

type ScoreInputsProps = {
  size?: Size
  disabled?: boolean
  // modo form
  casaName?: string
  foraName?: string
  defaultCasa?: number | null
  defaultFora?: number | null
  // modo controlado
  casa?: number | null
  fora?: number | null
  onChange?: (casa: number | null, fora: number | null) => void
}

export function ScoreInputs({
  size = 'lg',
  disabled,
  casaName,
  foraName,
  defaultCasa,
  defaultFora,
  casa,
  fora,
  onChange,
}: ScoreInputsProps) {
  const controlled = onChange != null
  const field = FIELD[size]

  return (
    <div className="flex items-center gap-3">
      <input
        type="number"
        inputMode="numeric"
        name={casaName}
        min={0}
        max={15}
        placeholder="0"
        disabled={disabled}
        className={field}
        {...(controlled
          ? { value: casa ?? '', onChange: (e) => onChange!(parse(e.target.value), fora ?? null) }
          : { defaultValue: defaultCasa ?? '' })}
      />
      <span className={size === 'lg' ? 'font-display text-2xl text-brasil-gold' : 'font-display text-xl text-brasil-gold'}>
        —
      </span>
      <input
        type="number"
        inputMode="numeric"
        name={foraName}
        min={0}
        max={15}
        placeholder="0"
        disabled={disabled}
        className={field}
        {...(controlled
          ? { value: fora ?? '', onChange: (e) => onChange!(casa ?? null, parse(e.target.value)) }
          : { defaultValue: defaultFora ?? '' })}
      />
    </div>
  )
}

export default ScoreInputs
