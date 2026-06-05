import Link from 'next/link'

// Cabeçalho editorial: régua dourada + eyebrow + título Anton, com CTA opcional.
export function SectionHeader({
  eyebrow,
  title,
  href,
  cta,
}: {
  eyebrow: string
  title: string
  href?: string
  cta?: string
}) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            {eyebrow}
          </span>
        </div>
        <h2 className="font-display text-4xl uppercase leading-[0.85] tracking-tight text-cream md:text-5xl">
          {title}
        </h2>
      </div>
      {href && cta && (
        <Link
          href={href}
          className="motion-cinema shrink-0 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-cream/50 hover:text-brasil-gold"
        >
          {cta} →
        </Link>
      )}
    </div>
  )
}

export default SectionHeader
