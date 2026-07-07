import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { atualizarConfig, definirPlacar90 } from '@/actions/admin'
import AdminActions from '@/components/AdminActions'

type KnockoutRow = {
  id: string
  time_casa: string
  time_fora: string
  slot_key: string | null
  placar_casa_90: number | null
  placar_fora_90: number | null
  fase: string | null
  status: string
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

export default async function AdminPage() {
  const profile = await getCurrentProfile()
  if (!profile?.is_admin) {
    redirect('/')
  }

  const supabase = await createClient()
  const [{ data: config }, { data: knockout }] = await Promise.all([
    supabase.from('scoring_config').select('*').eq('id', 1).single(),
    supabase
      .from('partidas')
      .select('id, time_casa, time_fora, slot_key, placar_casa_90, placar_fora_90, fase, status')
      .is('grupo', null)
      .in('status', ['SCHEDULED', 'TIMED', 'IN_PLAY'])
      .order('data_jogo', { ascending: true }),
  ])

  const c = config ?? {}
  const jogosMata = (knockout ?? []) as KnockoutRow[]

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <Settings className="text-warm-orange" size={20} />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-warm-orange">
            Bastidores
          </span>
        </div>
        <h1 className="font-display text-5xl uppercase leading-[0.85] tracking-tight text-cream md:text-6xl">
          Administra<span className="text-warm-orange">ção</span>
        </h1>
      </div>

      {/* Sincronização e recálculo */}
      <section className="space-y-4 rounded-[20px] border border-white/10 bg-surface p-6 shadow-poster">
        <h2 className="font-display text-xl uppercase tracking-wide text-brasil-gold">Jogos & Pontuação</h2>
        <p className="font-sans text-sm text-cream/50">
          Sincroniza os jogos e resultados pela API e recalcula todas as categorias de pontos.
        </p>
        <AdminActions />
        <Link
          href="/admin/bracket"
          className="motion-cinema inline-flex items-center gap-2 rounded-xl border border-warm-orange/30 bg-warm-orange/10 px-4 py-2.5 font-sans text-sm font-semibold text-warm-orange hover:bg-warm-orange/20"
        >
          Editar bracket real →
        </Link>
      </section>

      {/* Regras de pontuação (hierarquia completa) */}
      <section className="rounded-[20px] border border-white/10 bg-surface p-6 shadow-poster">
        <h2 className="mb-4 font-display text-xl uppercase tracking-wide text-brasil-gold">
          Regras de pontuação
        </h2>
        <form action={atualizarConfig} className="space-y-6">
          <Grid title="Por partida — jogo com vencedor">
            <Field name="pts_a" label="A · vencedor" defaultValue={c.pts_a ?? 3} />
            <Field name="pts_b" label="B · vencedor + gols do vencedor" defaultValue={c.pts_b ?? 4} />
            <Field name="pts_c" label="C · vencedor + gols do perdedor" defaultValue={c.pts_c ?? 4} />
            <Field name="pts_d" label="D · placar exato" defaultValue={c.pts_d ?? 5} />
          </Grid>
          <Grid title="Por partida — empate / consolação / bônus">
            <Field name="pts_e" label="E · empate certo" defaultValue={c.pts_e ?? 3} />
            <Field name="pts_f" label="F · empate exato" defaultValue={c.pts_f ?? 5} />
            <Field name="pts_p" label="P · cravou gols de um time" defaultValue={c.pts_p ?? 1} />
            <Field name="pts_solitario" label="Bônus placar solitário" defaultValue={c.pts_solitario ?? 2} />
          </Grid>
          <Grid title="Classificação dos grupos">
            <Field name="pts_posicao" label="Por posição certa" defaultValue={c.pts_posicao ?? 1} />
            <Field name="pts_grupo_completo" label="Bônus grupo completo" defaultValue={c.pts_grupo_completo ?? 3} />
          </Grid>
          <Grid title="Bônus finais">
            <Field name="pts_terceiro" label="3º lugar" defaultValue={c.pts_terceiro ?? 15} />
            <Field name="pts_vice" label="Vice" defaultValue={c.pts_vice ?? 18} />
            <Field name="pts_campeao" label="Campeão" defaultValue={c.pts_campeao ?? 23} />
            <Field name="pts_surpresa" label="Surpresa" defaultValue={c.pts_surpresa ?? 15} />
          </Grid>
          <div className="space-y-3">
            <p className="font-sans text-xs text-cream/40">
              Overrides manuais — se preenchidos, substituem o resultado calculado automaticamente pelas partidas. Deixe vazio para usar o cálculo automático.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <OverrideField id="campeao_override" label="Campeão" placeholder="Ex: Brasil" defaultValue={c.campeao_override ?? ''} />
              <OverrideField id="vice_override" label="Vice" placeholder="Ex: Argentina" defaultValue={c.vice_override ?? ''} />
              <OverrideField id="terceiro_override" label="3º lugar" placeholder="Ex: França" defaultValue={c.terceiro_override ?? ''} />
              <OverrideField id="surpresa_override" label="Surpresa" placeholder="Ex: Noruega" defaultValue={c.surpresa_override ?? ''} />
            </div>
          </div>
          <Grid title="Prazos">
            <div className="sm:col-span-2">
              <label htmlFor="precopa_deadline" className="block font-sans text-sm font-medium text-cream/80">
                Prazo da Pré-Copa
              </label>
              <p className="mb-1 font-sans text-xs text-cream/40">24h antes da abertura (UTC)</p>
              <input
                id="precopa_deadline"
                name="precopa_deadline"
                type="datetime-local"
                defaultValue={toLocalInput(c.precopa_deadline ?? null)}
                className="motion-cinema rounded-lg border border-white/10 bg-void px-3 py-2 text-cream outline-none focus:border-brasil-gold"
              />
            </div>
            <Field
              name="knockout_buffer_secs"
              label="Buffer mata-mata (segundos)"
              defaultValue={c.knockout_buffer_secs ?? 300}
            />
          </Grid>

          <button
            type="submit"
            className="motion-cinema w-full rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-6 py-3 font-display uppercase tracking-wide text-void hover:brightness-105 active:scale-[0.99] sm:w-auto"
          >
            Salvar regras e recalcular
          </button>
        </form>
      </section>

      {/* Placar 90' do mata-mata */}
      <section className="rounded-[20px] border border-white/10 bg-surface p-6 shadow-poster">
        <h2 className="mb-1 font-display text-xl uppercase tracking-wide text-brasil-gold">
          Placar 90&apos; do mata-mata
        </h2>
        <p className="mb-4 font-sans text-sm text-cream/50">
          O mata-mata pontua pelos 90 minutos. Informe o placar regulamentar e o slot do
          chaveamento (ex: R32-1, R16-3, QF-2, SF-1, THIRD, FINAL).
        </p>
        {jogosMata.length === 0 ? (
          <p className="font-sans text-sm text-cream/40">
            Nenhum jogo de mata-mata agendado ou em andamento.
          </p>
        ) : (
          <div className="space-y-3">
            {jogosMata.map((j) => (
              <form
                key={j.id}
                action={definirPlacar90}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-void/40 p-3"
              >
                <input type="hidden" name="partidaId" value={j.id} />
                <span className="min-w-0 flex-1 truncate font-sans text-sm text-cream/80">
                  {j.time_casa} × {j.time_fora}
                  {j.slot_key ? (
                    <span className="ml-2 text-cream/35">{j.slot_key}</span>
                  ) : null}
                  {j.status === 'IN_PLAY' ? (
                    <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase text-red-400">
                      ao vivo
                    </span>
                  ) : null}
                </span>
                <input
                  name="slot_key"
                  placeholder="slot"
                  defaultValue={j.slot_key ?? ''}
                  className="tabular w-20 rounded-lg border border-white/10 bg-void px-2 py-1.5 text-center text-sm text-cream outline-none focus:border-brasil-gold"
                />
                <input
                  name="placar_casa_90"
                  type="number"
                  min={0}
                  placeholder="–"
                  defaultValue={j.placar_casa_90 ?? ''}
                  className="tabular w-14 rounded-lg border border-white/10 bg-void px-2 py-1.5 text-center text-cream outline-none focus:border-brasil-gold"
                />
                <span className="text-cream/40">×</span>
                <input
                  name="placar_fora_90"
                  type="number"
                  min={0}
                  placeholder="–"
                  defaultValue={j.placar_fora_90 ?? ''}
                  className="tabular w-14 rounded-lg border border-white/10 bg-void px-2 py-1.5 text-center text-cream outline-none focus:border-brasil-gold"
                />
                <button
                  type="submit"
                  name="acao"
                  value="ao_vivo"
                  className="motion-cinema rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-red-400 hover:bg-red-500/20"
                >
                  Ao vivo
                </button>
                <button
                  type="submit"
                  name="acao"
                  value="finalizar"
                  className="motion-cinema rounded-lg bg-brasil-gold/90 px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-void hover:brightness-105"
                >
                  Finalizar
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Grid({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/45">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
    </div>
  )
}

function Field({
  name,
  label,
  defaultValue,
}: {
  name: string
  label: string
  defaultValue: number
}) {
  return (
    <div>
      <label htmlFor={name} className="block font-sans text-[11px] text-cream/60">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        defaultValue={defaultValue}
        className="tabular motion-cinema mt-1 w-full rounded-lg border border-white/10 bg-void px-3 py-2 text-cream outline-none focus:border-brasil-gold"
      />
    </div>
  )
}

function OverrideField({
  id,
  label,
  placeholder,
  defaultValue,
}: {
  id: string
  label: string
  placeholder: string
  defaultValue: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-sans text-[11px] text-cream/60">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="motion-cinema mt-1 w-full rounded-lg border border-white/10 bg-void px-3 py-2 text-cream outline-none placeholder:text-cream/20 focus:border-brasil-gold"
      />
    </div>
  )
}
