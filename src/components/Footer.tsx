// Rodapé editorial: branding de torneio, discreto.
export default function Footer() {
  return (
    <footer className="full-bleed relative mt-4 overflow-hidden border-t border-white/[0.07] bg-ink">
      <span className="ghost-number -bottom-10 left-1/2 -translate-x-1/2 text-[16rem] md:text-[22rem]">
        26
      </span>
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-12 text-center">
        <span className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide text-cream">
          <span className="text-brasil-gold">★</span> Bolão da Galera
        </span>
        <p className="max-w-xs font-sans text-xs leading-relaxed text-cream/40">
          Crava o placar. Encara a galera. Joga bonito. — Copa do Mundo 2026
        </p>
        <div className="editorial-rule my-2 w-24" />
        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-cream/30">
          Feito pra galera • {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  )
}
