// One-off: finaliza ("envia") a pré-copa de um usuário a partir do rascunho já
// salvo no banco (palpites de grupo) — gera palpite_classificacao e marca
// submitted=true. Reusa a MESMA lógica do enviarPreCopa (computeGroupStandings).
//
// Fala direto com a REST API do PostgREST via fetch (sem realtime/WebSocket),
// usando a service-role key — então roda em Node 20.
//
// Uso:
//   npx tsx scripts/finalizar-precopa.ts <user_id>            # inspeciona (dry-run)
//   npx tsx scripts/finalizar-precopa.ts <user_id> --apply    # aplica

import { readFileSync } from 'node:fs'
import { computeGroupStandings } from '../src/lib/standings'
import type { GroupMatchScore } from '../src/lib/types'

// carrega .env.local
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  const key = t.slice(0, i).replace(/^export\s+/, '').trim()
  let val = t.slice(i + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
  process.env[key] = val
}

const userId = process.argv[2]
const apply = process.argv.includes('--apply')
if (!userId) {
  console.error('Falta o user_id. Uso: npx tsx scripts/finalizar-precopa.ts <user_id> [--apply]')
  process.exit(1)
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const REST = `${URL_BASE}/rest/v1`

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${REST}${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`)
  return res
}
const getJson = async <T>(path: string): Promise<T> => (await rest(path)).json() as Promise<T>

type GroupPartida = { id: string; grupo: string; time_casa: string; time_fora: string }
type PalpiteRow = { partida_id: string; palpite_casa: number | null; palpite_fora: number | null }

async function main() {
  const u = `eq.${userId}`

  const partidas = await getJson<GroupPartida[]>(
    `/partidas?select=id,grupo,time_casa,time_fora&grupo=not.is.null`,
  )

  // placares do usuário (paginado)
  const palpites: PalpiteRow[] = []
  for (let off = 0; ; off += 1000) {
    const page = await getJson<PalpiteRow[]>(
      `/palpites?select=partida_id,palpite_casa,palpite_fora&user_id=${u}&order=partida_id&limit=1000&offset=${off}`,
    )
    palpites.push(...page)
    if (page.length < 1000) break
  }
  const scoreByPartida = new Map<string, { casa: number | null; fora: number | null }>()
  for (const p of palpites) scoreByPartida.set(p.partida_id, { casa: p.palpite_casa, fora: p.palpite_fora })

  const brk = await getJson<{ slot_key: string }[]>(`/palpite_bracket?select=slot_key&user_id=${u}`)
  const klass = await getJson<{ posicao: number }[]>(`/palpite_classificacao?select=posicao&user_id=${u}`)
  const fin = await getJson<Record<string, unknown>[]>(
    `/palpite_final?select=campeao,vice,terceiro,surpresa&user_id=${u}`,
  )
  const stRows = await getJson<{ submitted: boolean; submitted_at: string | null }[]>(
    `/precopa_status?select=submitted,submitted_at&user_id=${u}`,
  )

  const faltam = partidas.filter((p) => {
    const s = scoreByPartida.get(p.id)
    return !s || s.casa == null || s.fora == null
  })

  console.log('── ESTADO ATUAL', userId, '──')
  console.log('jogos de grupo no torneio :', partidas.length)
  console.log('placares de grupo salvos  :', partidas.length - faltam.length, `(faltam ${faltam.length})`)
  console.log('palpite_bracket (picks)   :', brk.length)
  console.log('palpite_classificacao     :', klass.length)
  console.log('palpite_final             :', fin[0] ? JSON.stringify(fin[0]) : 'NENHUM')
  console.log('precopa_status.submitted  :', stRows[0]?.submitted ?? '(sem linha)')

  if (faltam.length > 0) {
    console.log('\n⚠ Placares de grupo INCOMPLETOS — não dá pra derivar a classificação. (enviarPreCopa também bloquearia.) Abortando.')
    return
  }

  // deriva classificação (idêntico a gravarClassificacao)
  const byGroup = new Map<string, GroupPartida[]>()
  for (const p of partidas) {
    const arr = byGroup.get(p.grupo) ?? []
    arr.push(p)
    byGroup.set(p.grupo, arr)
  }
  const rows: { user_id: string; grupo: string; posicao: number; time: string; pontos_grupo: number; saldo: number; gols_pro: number }[] = []
  for (const [grupo, jogos] of byGroup) {
    const teams = Array.from(new Set(jogos.flatMap((j) => [j.time_casa, j.time_fora])))
    const matches: GroupMatchScore[] = jogos.map((j) => {
      const s = scoreByPartida.get(j.id)
      return { home: j.time_casa, away: j.time_fora, homeGoals: s?.casa ?? null, awayGoals: s?.fora ?? null }
    })
    for (const st of computeGroupStandings(teams, matches)) {
      rows.push({ user_id: userId, grupo, posicao: st.position, time: st.team, pontos_grupo: st.points, saldo: st.gd, gols_pro: st.gf })
    }
  }

  console.log(`\n── CLASSIFICAÇÃO DERIVADA (${rows.length} linhas) ──`)
  for (const [grupo] of byGroup) {
    const gr = rows.filter((r) => r.grupo === grupo).sort((a, b) => a.posicao - b.posicao)
    console.log(grupo + ':', gr.map((r) => `${r.posicao}.${r.time}(${r.pontos_grupo}pt ${r.saldo >= 0 ? '+' : ''}${r.saldo})`).join('  '))
  }

  if (!apply) {
    console.log('\n[DRY-RUN] Nada foi gravado. Rode de novo com --apply para aplicar.')
    return
  }

  await rest(`/palpite_classificacao?user_id=${u}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  await rest(`/palpite_classificacao`, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) })
  const nowIso = new Date().toISOString()
  await rest(`/precopa_status?on_conflict=user_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, submitted: true, submitted_at: nowIso, updated_at: nowIso }),
  })

  console.log('\n✅ APLICADO: classificação gravada e submitted=true.')
  console.log('   Rode "Recalcular pontuação" no admin pra pontuar esse usuário.')
}

main().catch((e) => {
  console.error('ERRO:', e)
  process.exit(1)
})
