import Link from 'next/link'
import StatRing from '@/components/home/StatRing'
import { Countdown } from '@/components/Countdown'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth'

// Banner da home: progresso da pré-Copa + contagem regressiva até o prazo.
// Some quando não há fase de grupos sincronizada. Colapsa após o envio.
export default async function PreCopaCallout() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) return null

  const [grpRes, tmplRes, palRes, brkRes, finRes, cfgRes, stRes] = await Promise.all([
    supabase.from('partidas').select('id', { count: 'exact', head: true }).not('grupo', 'is', null),
    supabase.from('bracket_template').select('slot_key', { count: 'exact', head: true }),
    supabase
      .from('palpites')
      .select('partida_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('fase_palpite', 'GRUPO'),
    supabase.from('palpite_bracket').select('slot_key', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('palpite_final').select('campeao, vice, terceiro, surpresa').eq('user_id', user.id).maybeSingle(),
    supabase.from('scoring_config').select('precopa_deadline').eq('id', 1).maybeSingle(),
    supabase.from('precopa_status').select('submitted').eq('user_id', user.id).maybeSingle(),
  ])

  const scoresTotal = grpRes.count ?? 0
  if (scoresTotal === 0) return null // sem fase de grupos ainda

  const scoresFilled = palRes.count ?? 0
  const bracketTotal = tmplRes.count ?? 0
  const bracketFilled = brkRes.count ?? 0
  const fin = finRes.data
  const finaisDone = !!(fin?.campeao && fin?.vice && fin?.terceiro && fin?.surpresa)
  const deadline = (cfgRes.data?.precopa_deadline as string | null) ?? null
  const submitted = !!stRes.data?.submitted
  const closed = deadline ? new Date(deadline).getTime() <= Date.now() : false

  const pct = Math.round(
    ((scoresTotal ? scoresFilled / scoresTotal : 0) * 0.7 +
      (bracketTotal ? bracketFilled / bracketTotal : 0) * 0.25 +
      (finaisDone ? 1 : 0) * 0.05) *
      100,
  )

  // Enviada → estado calmo.
  if (submitted) {
    return (
      <section className="mb-10">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-pitch-vivid/30 bg-pitch-vivid/[0.06] px-5 py-4">
          <div>
            <p className="font-display text-lg uppercase tracking-wide text-pitch-vivid">
              Pré-Copa enviada ✓
            </p>
            <p className="font-sans text-sm text-cream/55">Tudo congelado — agora é torcer.</p>
          </div>
          <Link
            href="/pre-copa"
            className="motion-cinema shrink-0 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-cream/50 hover:text-brasil-gold"
          >
            Ver palpite →
          </Link>
        </div>
      </section>
    )
  }

  // Prazo encerrado sem envio.
  if (closed) {
    return (
      <section className="mb-10">
        <div className="rounded-2xl border border-white/10 bg-surface px-5 py-4 text-center">
          <p className="font-sans text-sm uppercase tracking-[0.15em] text-cream/50">
            🔒 Pré-Copa encerrada
          </p>
        </div>
      </section>
    )
  }

  // Em aberto → CTA + progresso + countdown.
  return (
    <section className="mb-10">
      <div className="relative overflow-hidden rounded-[20px] border border-brasil-gold/25 bg-surface p-5 shadow-poster md:p-7">
        <span className="turf-layer" aria-hidden />
        <div className="relative z-10 flex flex-col items-center gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <StatRing pct={pct} label="Completo" size={84} />
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-[2px] w-6 bg-brasil-gold" />
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-brasil-gold">
                  Palpite único
                </span>
              </div>
              <h2 className="font-display text-3xl uppercase leading-none tracking-tight text-cream md:text-4xl">
                Sua Pré-Copa
              </h2>
              <p className="mt-2 font-sans text-sm text-cream/55">
                <strong className="tabular text-cream">{scoresFilled}</strong>/{scoresTotal} placares ·{' '}
                <strong className="tabular text-cream">{bracketFilled}</strong>/{bracketTotal} chave ·{' '}
                finais {finaisDone ? '✓' : '—'}
              </p>
              {deadline && (
                <p className="mt-1 font-sans text-xs text-cream/45">
                  Fecha em <Countdown target={deadline} className="text-brasil-gold" />
                </p>
              )}
            </div>
          </div>
          <Link
            href="/pre-copa"
            className="motion-cinema w-full shrink-0 rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-6 py-3 text-center font-display text-sm uppercase tracking-[0.15em] text-void shadow-lg shadow-brasil-gold/20 hover:brightness-105 active:scale-[0.98] md:w-auto"
          >
            {scoresFilled > 0 || bracketFilled > 0 ? 'Continuar pré-Copa' : 'Fazer pré-Copa'} →
          </Link>
        </div>
      </div>
    </section>
  )
}
