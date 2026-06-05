import Image from 'next/image'

// Shell compartilhado entre /login e /signup: o pôster editorial fica à
// esquerda e cada página injeta o seu formulário no painel da direita.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[82vh] items-center justify-center">
      <div className="shadow-poster grid w-full max-w-4xl overflow-hidden rounded-[24px] border border-white/10 md:grid-cols-2">
        {/* ── Lado editorial: pôster em papel/creme com a chuteira T90 ── */}
        <div className="paper relative hidden flex-col justify-between overflow-hidden p-8 md:flex">
          <span className="ghost-number -left-4 bottom-[-3rem] text-[16rem] !text-[#15110c] !opacity-[0.06]">
            90
          </span>

          <div className="relative z-10">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-warm-orange">
              Total 90 · est. 2004
            </span>
            <h2 className="mt-2 font-display text-6xl uppercase leading-[0.82] tracking-tight text-[#15110c]">
              Joga
              <br />
              Bonito
            </h2>
          </div>

          <div className="relative z-10 my-2">
            <Image
              src="/icons/boots.png"
              alt="Chuteira Nike Total 90"
              width={500}
              height={500}
              className="mx-auto w-full max-w-[320px] -rotate-6 drop-shadow-[0_18px_30px_rgba(0,0,0,0.25)]"
              priority
            />
          </div>

          <p className="relative z-10 font-sans text-sm leading-relaxed text-[#15110c]/60">
            O bolão da galera. Crava os placares, soma os pontos e levanta a taça
            no fim da Copa.
          </p>
        </div>

        {/* ── Painel do formulário ── */}
        <div className="relative bg-surface p-8 md:p-10">
          <span className="turf-layer" aria-hidden />
          <div className="relative z-10 flex h-full flex-col justify-center">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
