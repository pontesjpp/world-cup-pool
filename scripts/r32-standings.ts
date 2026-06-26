// Lê os resultados da fase de grupos do banco e resolve quais confrontos do R32
// já estão definidos (sem depender dos 3ºs, ou com grupos já encerrados).
//
// Uso:
//   npx tsx scripts/r32-standings.ts          # mostra standings + R32 resolvido

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
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` }

type Partida = {
  time_casa: string
  time_fora: string
  placar_casa: number
  placar_fora: number
  grupo: string
  status: string
}

type Standing = {
  team: string
  pts: number
  gd: number
  gf: number
  played: number
}

// Extrai a letra do grupo: "GROUP_A" → "A"
function grupoLetra(g: string): string {
  return g.replace(/^GROUP_/, '')
}

function computeStandings(partidas: Partida[]): Record<string, Standing[]> {
  const table: Record<string, Record<string, Standing>> = {}

  for (const p of partidas) {
    if (p.status !== 'FINISHED') continue
    const g = grupoLetra(p.grupo)
    if (!table[g]) table[g] = {}

    const ensure = (team: string) => {
      if (!table[g][team]) table[g][team] = { team, pts: 0, gd: 0, gf: 0, played: 0 }
    }
    ensure(p.time_casa)
    ensure(p.time_fora)

    const casa = table[g][p.time_casa]
    const fora = table[g][p.time_fora]
    casa.played++
    fora.played++
    casa.gf += p.placar_casa
    fora.gf += p.placar_fora
    casa.gd += p.placar_casa - p.placar_fora
    fora.gd += p.placar_fora - p.placar_casa

    if (p.placar_casa > p.placar_fora) {
      casa.pts += 3
    } else if (p.placar_casa < p.placar_fora) {
      fora.pts += 3
    } else {
      casa.pts += 1
      fora.pts += 1
    }
  }

  const result: Record<string, Standing[]> = {}
  for (const [g, teams] of Object.entries(table)) {
    result[g] = Object.values(teams).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.gf !== a.gf) return b.gf - a.gf
      return a.team.localeCompare(b.team)
    })
  }
  return result
}

// bracket_template: source_home/source_away → token como '1A', '2B', '3RD'
const R32: { slot: string; matchNo: number; home: string; away: string }[] = [
  { slot: 'R32-1',  matchNo: 73, home: '2A', away: '2B'  },
  { slot: 'R32-2',  matchNo: 74, home: '1E', away: '3RD' },
  { slot: 'R32-3',  matchNo: 75, home: '1F', away: '2C'  },
  { slot: 'R32-4',  matchNo: 76, home: '1C', away: '2F'  },
  { slot: 'R32-5',  matchNo: 77, home: '1I', away: '3RD' },
  { slot: 'R32-6',  matchNo: 78, home: '2E', away: '2I'  },
  { slot: 'R32-7',  matchNo: 79, home: '1A', away: '3RD' },
  { slot: 'R32-8',  matchNo: 80, home: '1L', away: '3RD' },
  { slot: 'R32-9',  matchNo: 81, home: '1D', away: '3RD' },
  { slot: 'R32-10', matchNo: 82, home: '1G', away: '3RD' },
  { slot: 'R32-11', matchNo: 83, home: '2K', away: '2L'  },
  { slot: 'R32-12', matchNo: 84, home: '1H', away: '2J'  },
  { slot: 'R32-13', matchNo: 85, home: '1B', away: '3RD' },
  { slot: 'R32-14', matchNo: 86, home: '1J', away: '2H'  },
  { slot: 'R32-15', matchNo: 87, home: '1K', away: '3RD' },
  { slot: 'R32-16', matchNo: 88, home: '2D', away: '2G'  },
]

function resolveToken(token: string, standings: Record<string, Standing[]>): string | null {
  if (token === '3RD') return '3RD'
  const pos = Number(token[0]) - 1 // '1' → 0, '2' → 1
  const grupo = token[1]            // 'A', 'B', …
  const rows = standings[grupo]
  if (!rows || rows.length < pos + 1) return null
  // Só retorna se o grupo tiver pelo menos 3 jogos encerrados (grupo fechado)
  const totalJogos = rows.reduce((s, r) => s + r.played, 0) / 2
  if (totalJogos < 6) return null   // grupo com 4 times tem 6 jogos
  return rows[pos].team
}

async function main() {
  const res = await fetch(
    `${REST}/partidas?select=time_casa,time_fora,placar_casa,placar_fora,grupo,status&grupo=not.is.null&limit=1000`,
    { headers },
  )
  const partidas = (await res.json()) as Partida[]

  const standings = computeStandings(partidas)

  // Mostra os standings por grupo
  const grupos = Object.keys(standings).sort()
  console.log('════ STANDINGS DA FASE DE GRUPOS ════\n')
  for (const g of grupos) {
    const rows = standings[g]
    const totalJogos = rows.reduce((s, r) => s + r.played, 0) / 2
    const fechado = totalJogos >= 6 ? '✅' : `⏳ (${totalJogos}/6)`
    console.log(`Grupo ${g} ${fechado}`)
    rows.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.team.padEnd(25)} ${r.pts}pts  GD${r.gd >= 0 ? '+' : ''}${r.gd}  GF${r.gf}`)
    })
    console.log('')
  }

  // Resolve R32
  console.log('════ R32 — CONFRONTOS ════\n')
  let pendente = false
  for (const slot of R32) {
    const h = resolveToken(slot.home, standings)
    const a = resolveToken(slot.away, standings)

    const hStr = h ?? `? (${slot.home})`
    const aStr = a ?? `? (${slot.away})`
    const pronto = h !== null && a !== null && h !== '3RD' && a !== '3RD'
    const tem3rd = (h === '3RD' || a === '3RD')
    const hConfirmado = h !== null && h !== '3RD'
    const aConfirmado = a !== null && a !== '3RD'
    const parcial = !pronto && (hConfirmado || aConfirmado)

    let status: string
    if (pronto) status = '✅ pronto'
    else if (parcial && tem3rd) status = '🔶 parcial — 3º lugar pendente'
    else if (parcial) status = '🔶 parcial — grupo incompleto'
    else if (tem3rd) status = '⏳ 3º lugar pendente'
    else status = '⏳ grupo incompleto'

    console.log(`${slot.slot.padEnd(7)} #${String(slot.matchNo).padEnd(4)} ${hStr.padEnd(28)} × ${aStr.padEnd(28)}  ${status}`)
    if (!pronto) pendente = true
  }

  if (pendente) {
    console.log('\n⏳ = aguardando grupos fecharem ou tabela de 3ºs ser definida')
  }
}

main().catch((e) => {
  console.error('ERRO:', e instanceof Error ? e.message : e)
  process.exit(1)
})
