// Mostra o que a football-data.org está reportando AGORA (status + placar) e
// compara com o que está no banco — pra você saber quando a API "fechou" um
// jogo e é seguro sincronizar (sem sobrescrever o placar ao vivo que você
// digitou na mão com scripts/placar.ts).
//
// Lê o mesmo endpoint que sincronizarPartidas (src/actions/admin.ts).
// Roda em Node 20 (npx tsx), lendo FOOTBALL_API_KEY do .env.local.
//
// Uso:
//   npx tsx scripts/api-jogos.ts          # jogos de hoje: API vs banco
//   npx tsx scripts/api-jogos.ts bra      # filtra por trecho do nome do time
//   npx tsx scripts/api-jogos.ts --tudo   # todos os jogos do torneio

import { readFileSync } from 'node:fs'

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

const REST = `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')}/rest/v1`
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const API_KEY = process.env.FOOTBALL_API_KEY!
const FOOTBALL_API = 'https://api.football-data.org/v4/competitions/WC/matches'

type ApiMatch = {
  id: number
  utcDate: string
  status: string
  homeTeam: { name?: string | null }
  awayTeam: { name?: string | null }
  score?: { fullTime?: { home?: number | null; away?: number | null } }
}
type DbRow = { external_id: number; status: string; placar_casa: number | null; placar_fora: number | null }

const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

// Selo curto por status, igual ao placar.ts.
const selo = (s: string) =>
  ({ IN_PLAY: '🔴 ao vivo', PAUSED: '⏸ intervalo', FINISHED: '✅ encerrado' } as Record<string, string>)[s] ??
  `🕐 ${s.toLowerCase()}`

const sc = (h?: number | null, a?: number | null) => (h == null || a == null ? '–×–' : `${h}×${a}`)

async function main() {
  const argv = process.argv.slice(2)
  const tudo = argv.includes('--tudo')
  const filtro = argv.find((a) => !a.startsWith('--'))?.toLowerCase()

  if (!API_KEY) {
    console.error('⚠ FOOTBALL_API_KEY não configurada no .env.local.')
    process.exit(1)
  }

  // 1) API
  const res = await fetch(FOOTBALL_API, { headers: { 'X-Auth-Token': API_KEY }, cache: 'no-store' })
  if (!res.ok) {
    console.error(`⚠ API retornou ${res.status} ${res.statusText}`)
    process.exit(1)
  }
  let matches = ((await res.json()) as { matches?: ApiMatch[] }).matches ?? []

  // 2) Banco (status atual gravado), indexado por external_id
  const dbRows = (await (
    await fetch(`${REST}/partidas?select=external_id,status,placar_casa,placar_fora&limit=1000`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    })
  ).json()) as DbRow[]
  const db = new Map(dbRows.map((r) => [r.external_id, r]))

  // Janela: hoje (−6h … +18h) salvo --tudo. Mais filtro opcional por nome.
  const desde = Date.now() - 6 * 3600_000
  const ate = Date.now() + 18 * 3600_000
  matches = matches
    .filter((m) => m.homeTeam?.name && m.awayTeam?.name)
    .filter((m) => tudo || (new Date(m.utcDate).getTime() >= desde && new Date(m.utcDate).getTime() <= ate))
    .filter(
      (m) =>
        !filtro ||
        m.homeTeam.name!.toLowerCase().includes(filtro) ||
        m.awayTeam.name!.toLowerCase().includes(filtro),
    )
    .sort((a, b) => +new Date(a.utcDate) - +new Date(b.utcDate))

  if (matches.length === 0) {
    console.log('Nenhum jogo encontrado nessa janela/filtro.')
    return
  }

  console.log('── API (football-data.org)  vs  BANCO ──\n')
  for (const m of matches) {
    const d = db.get(m.id)
    const apiSel = selo(m.status)
    const apiScore = sc(m.score?.fullTime?.home, m.score?.fullTime?.away)
    const dbSel = d ? selo(d.status) : '— (não está no banco)'
    const dbScore = d ? sc(d.placar_casa, d.placar_fora) : '—'
    const divergente = d && (d.status !== m.status || dbScore !== apiScore)

    console.log(`${hora(m.utcDate)}  ${m.homeTeam.name} × ${m.awayTeam.name}`)
    console.log(`   API   : ${apiScore.padEnd(6)} ${apiSel}`)
    console.log(`   BANCO : ${dbScore.padEnd(6)} ${dbSel}${divergente ? '   ⚠ divergente' : ''}`)

    if (m.status === 'FINISHED' && d?.status !== 'FINISHED') {
      console.log('   → API já ENCERROU este jogo. Pode sincronizar pra gravar o oficial. ✅')
    } else if ((m.status === 'SCHEDULED' || m.status === 'TIMED') && d && d.status !== m.status) {
      console.log('   → API ainda NÃO foi ao ar (não puxa ao vivo). NÃO sincronize agora. ⛔')
    }
    console.log('')
  }
}

main().catch((e) => {
  console.error('ERRO:', e instanceof Error ? e.message : e)
  process.exit(1)
})
