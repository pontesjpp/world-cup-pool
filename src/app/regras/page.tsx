import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Regras — Bolão Ponts',
}

type Cfg = Record<string, number | null>

// Valores padrão do regulamento, usados como fallback caso a config não exista.
const DEFAULTS: Record<string, number> = {
  pts_a: 3,
  pts_b: 4,
  pts_c: 4,
  pts_d: 5,
  pts_e: 3,
  pts_f: 5,
  pts_p: 1,
  pts_solitario: 2,
  pts_posicao: 1,
  pts_grupo_completo: 3,
  pts_terceiro: 15,
  pts_vice: 18,
  pts_campeao: 23,
  pts_surpresa: 15,
}

function Section({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-surface p-6 shadow-poster md:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="h-[2px] w-8 bg-brasil-gold" />
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
          {kicker}
        </h2>
      </div>
      {children}
    </section>
  )
}

function Rule({
  pts,
  label,
  desc,
}: {
  pts: number
  label: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-4 py-3.5">
      <span className="tabular flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brasil-gold/30 bg-void/40 font-display text-lg text-brasil-gold">
        {pts}
      </span>
      <div className="min-w-0">
        <p className="font-display text-base uppercase leading-tight tracking-wide text-cream">
          {label}
        </p>
        <p className="mt-0.5 font-sans text-sm text-cream/50">{desc}</p>
      </div>
    </div>
  )
}

export default async function Regras() {
  const supabase = await createClient()
  const { data } = await supabase.from('scoring_config').select('*').eq('id', 1).single()
  const cfg = (data ?? {}) as Cfg
  const p = (key: string): number => {
    const v = cfg[key]
    return typeof v === 'number' ? v : DEFAULTS[key]
  }

  return (
    <div>
      {/* Cabeçalho editorial */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            O Regulamento
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-7xl">
          Re<span className="text-brasil-gold">gras</span>
        </h1>
        <p className="mt-4 max-w-2xl font-sans text-sm text-cream/50">
          Em cada jogo vale apenas a <strong className="text-cream/80">melhor</strong> categoria
          atingida — elas não se somam. Veja como cada palpite pontua.
        </p>
      </div>

      <div className="space-y-5">
        {/* Jogo com vencedor */}
        <Section kicker="Por partida · jogo com vencedor">
          <div className="divide-y divide-white/5">
            <Rule
              pts={p('pts_d')}
              label="Placar exato"
              desc="Cravou o resultado certinho, com vencedor (ex.: palpite 2×1, deu 2×1)."
            />
            <Rule
              pts={p('pts_b')}
              label="Vencedor + gols do vencedor"
              desc="Acertou quem ganhou e quantos gols o vencedor fez."
            />
            <Rule
              pts={p('pts_c')}
              label="Vencedor + gols do perdedor"
              desc="Acertou quem ganhou e quantos gols o perdedor fez."
            />
            <Rule
              pts={p('pts_a')}
              label="Só o vencedor"
              desc="Acertou apenas quem ganhou, errando os dois placares."
            />
          </div>
        </Section>

        {/* Empate / consolação / bônus */}
        <Section kicker="Por partida · empate, consolação e bônus">
          <div className="divide-y divide-white/5">
            <Rule
              pts={p('pts_f')}
              label="Empate exato"
              desc="Cravou o placar do empate (ex.: palpite 2×2, deu 2×2)."
            />
            <Rule
              pts={p('pts_e')}
              label="Empate certo"
              desc="Acertou que seria empate, mas com placar diferente (ex.: palpite 0×0, deu 2×2)."
            />
            <Rule
              pts={p('pts_p')}
              label="Cravou os gols de um time"
              desc="Errou o resultado, mas acertou quantos gols um dos times fez."
            />
            <Rule
              pts={p('pts_solitario')}
              label="Bônus placar solitário"
              desc="Extra para quem foi o único a cravar o placar exato (D ou F) de uma partida."
            />
          </div>
        </Section>

        {/* Classificação dos grupos */}
        <Section kicker="Fase de grupos · classificação">
          <div className="divide-y divide-white/5">
            <Rule
              pts={p('pts_posicao')}
              label="Por posição certa"
              desc="Para cada posição acertada na tabela final de um grupo."
            />
            <Rule
              pts={p('pts_grupo_completo')}
              label="Bônus grupo completo"
              desc="Extra por acertar as 4 posições de um grupo inteiro."
            />
          </div>
        </Section>

        {/* Bônus finais */}
        <Section kicker="Bônus das finais">
          <div className="divide-y divide-white/5">
            <Rule pts={p('pts_campeao')} label="Campeão" desc="Acertou quem levanta a taça." />
            <Rule pts={p('pts_vice')} label="Vice-campeão" desc="Acertou o finalista derrotado." />
            <Rule pts={p('pts_terceiro')} label="3º lugar" desc="Acertou quem fica em terceiro." />
            <Rule
              pts={p('pts_surpresa')}
              label="Surpresa"
              desc="Acertou o zebra que foi mais longe no torneio."
            />
          </div>
        </Section>

        {/* Chaveamento (informativo) */}
        <Section kicker="Mata-mata · chaveamento">
          <p className="font-sans text-sm text-cream/60">
            No chaveamento, cada confronto previsto pontua por time que você acerta avançando — e
            o valor cresce a cada fase. Quanto mais perto da final, mais vale cravar quem chega lá.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-sans text-[13px] text-cream/45">
            <span>32-avos <strong className="tabular text-cream/70">3</strong></span>
            <span>Oitavas <strong className="tabular text-cream/70">6</strong></span>
            <span>Quartas <strong className="tabular text-cream/70">9</strong></span>
            <span>Semis <strong className="tabular text-cream/70">12</strong></span>
            <span>Final / 3º <strong className="tabular text-cream/70">13</strong></span>
            <span className="text-cream/30">pontos por time acertado</span>
          </p>
        </Section>

        <p className="px-2 font-sans text-xs text-cream/30">
          No mata-mata, vale o placar dos 90 minutos. Os palpites de cada jogo fecham minutos antes
          do apito inicial.
        </p>
      </div>
    </div>
  )
}
