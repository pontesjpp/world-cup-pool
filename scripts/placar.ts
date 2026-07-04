// Altera o placar de um jogo AO VIVO direto no banco — porque a football-data.org
// não entrega placar em tempo real. A UI mostra jogo com status IN_PLAY/PAUSED
// lendo placar_casa/placar_fora e recalcula os pontos provisórios da galera em
// cima do placar parcial (ver src/components/MatchCard.tsx). A pontuação
// DEFINITIVA só conta jogos FINISHED — então encerre com --fim e depois rode
// "Recalcular pontuação" no admin (ou sincronize a API).
//
// Fala direto com a REST API do PostgREST via fetch (service-role key), igual a
// finalizar-precopa.ts / estatisticas.ts — roda em Node 20 (npx tsx).
//
// Uso:
//   npx tsx scripts/placar.ts                          # lista os jogos de hoje
//   npx tsx scripts/placar.ts bra 2 1                  # Brasil ao vivo: 2 × 1 (IN_PLAY)
//   npx tsx scripts/placar.ts 3 2 1                    # jogo #3 da lista: 2 × 1 (IN_PLAY)
//   npx tsx scripts/placar.ts bra 2 1 --fim           # encerra: 2 × 1 (FINISHED)
//   npx tsx scripts/placar.ts bra --pausa             # intervalo (PAUSED), mantém placar
//   npx tsx scripts/placar.ts bra --fim               # encerra com o placar atual
//   npx tsx scripts/placar.ts bra --agendar           # volta pra SCHEDULED (zera placar)

import { readFileSync } from 'node:fs'

// carrega .env.local (mesmo padrão dos outros scripts)
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
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

type Partida = {
  id: string
  time_casa: string
  time_fora: string
  data_jogo: string
  status: string
  placar_casa: number | null
  placar_fora: number | null
  fase: string | null
  grupo: string | null
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${REST}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`)
  return res
}

const AO_VIVO = new Set(['IN_PLAY', 'PAUSED'])

// Hora no fuso de Brasília (UTC-3), igual ao resto do app.
const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const placar = (p: Partida) =>
  p.placar_casa == null || p.placar_fora == null ? '–×–' : `${p.placar_casa}×${p.placar_fora}`

const tag = (p: Partida) =>
  ({ IN_PLAY: '🔴 AO VIVO', PAUSED: '⏸ INTERVALO', FINISHED: '✅ ENCERRADO' } as Record<string, string>)[
    p.status
  ] ?? '🕐 agendado'

// Jogos de "hoje-ish": −6h … +18h. Usado apenas para listar sem seletor.
async function listarHoje(): Promise<Partida[]> {
  const desde = new Date(Date.now() - 6 * 3600_000).toISOString()
  const ate = new Date(Date.now() + 18 * 3600_000).toISOString()
  const cols = 'id,time_casa,time_fora,data_jogo,status,placar_casa,placar_fora,fase,grupo'
  const jogos = (await (
    await rest(
      `/partidas?select=${cols}&data_jogo=gte.${desde}&data_jogo=lte.${ate}&order=data_jogo.asc&limit=1000`,
    )
  ).json()) as Partida[]
  return jogos
}

// Busca um jogo específico por nome de time (sem restrição de data).
async function buscarPorNome(q: string): Promise<Partida[]> {
  const cols = 'id,time_casa,time_fora,data_jogo,status,placar_casa,placar_fora,fase,grupo'
  const [casa, fora] = await Promise.all([
    (await rest(`/partidas?select=${cols}&time_casa=ilike.*${encodeURIComponent(q)}*&order=data_jogo.desc&limit=5`)).json() as Promise<Partida[]>,
    (await rest(`/partidas?select=${cols}&time_fora=ilike.*${encodeURIComponent(q)}*&order=data_jogo.desc&limit=5`)).json() as Promise<Partida[]>,
  ])
  const seen = new Set<string>()
  return [...casa, ...fora].filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  }).sort((a, b) => +new Date(b.data_jogo) - +new Date(a.data_jogo))
}

function imprimirLista(jogos: Partida[]) {
  if (jogos.length === 0) {
    console.log('Nenhum jogo na janela de hoje (−6h … +18h).')
    return
  }
  console.log('── JOGOS DE HOJE ──')
  jogos.forEach((p, i) => {
    const ctx = p.grupo ? `Grupo ${p.grupo.replace(/^GROUP_/, '')}` : p.fase ?? ''
    console.log(
      `${String(i + 1).padStart(2)}. ${hora(p.data_jogo)}  ${p.time_casa} ${placar(p)} ${p.time_fora}` +
        `   ${tag(p)}${ctx ? `  · ${ctx}` : ''}`,
    )
  })
  console.log('\nEx.: npx tsx scripts/placar.ts <time|nº> <casa> <fora> [--fim|--pausa]')
}

// Resolve o seletor: nº da lista (1-based) ou substring do nome de um dos times.
function resolver(jogos: Partida[], seletor: string): Partida | { erro: string } {
  const idx = Number(seletor)
  if (Number.isInteger(idx) && String(idx) === seletor.trim()) {
    const p = jogos[idx - 1]
    return p ?? { erro: `Não existe jogo #${idx} na lista (são ${jogos.length}).` }
  }
  const q = seletor.toLowerCase()
  const hits = jogos.filter(
    (p) => p.time_casa.toLowerCase().includes(q) || p.time_fora.toLowerCase().includes(q),
  )
  if (hits.length === 0) return { erro: `Nenhum jogo de hoje com "${seletor}".` }
  if (hits.length > 1)
    return {
      erro: `"${seletor}" casa com ${hits.length} jogos: ${hits
        .map((p) => `${p.time_casa}×${p.time_fora}`)
        .join(', ')}. Seja mais específico ou use o nº.`,
    }
  return hits[0]
}

async function main() {
  const argv = process.argv.slice(2)
  const jogos = await listarHoje()

  if (argv.length === 0) {
    imprimirLista(jogos)
    return
  }

  const seletor = argv[0]
  const flags = argv.filter((a) => a.startsWith('--'))
  const nums = argv.slice(1).filter((a) => !a.startsWith('--'))

  // Tenta resolver na janela de hoje; se falhar e for texto, busca em todo o torneio.
  let alvo = resolver(jogos, seletor)
  if ('erro' in alvo && !/^\d+$/.test(seletor.trim())) {
    const todos = await buscarPorNome(seletor)
    if (todos.length === 1) {
      alvo = todos[0]
      console.log(`ℹ Jogo fora da janela de hoje — encontrado pelo nome: ${alvo.time_casa} × ${alvo.time_fora} (${hora(alvo.data_jogo)})`)
    } else if (todos.length > 1) {
      // Prefere o único não-encerrado (evita ambiguidade quando o mesmo time jogou várias vezes).
      const abertos = todos.filter((p) => p.status !== 'FINISHED')
      if (abertos.length === 1) {
        alvo = abertos[0]
        console.log(`ℹ Jogo fora da janela de hoje — encontrado pelo nome: ${alvo.time_casa} × ${alvo.time_fora} (${hora(alvo.data_jogo)})`)
      } else {
        console.error(`⚠ "${seletor}" casa com ${todos.length} jogos fora da janela:`)
        todos.forEach((p) => console.error(`   ${hora(p.data_jogo)}  ${p.time_casa} × ${p.time_fora}  ${tag(p)}`))
        process.exit(1)
      }
    }
  }
  if ('erro' in alvo) {
    console.error('⚠ ' + alvo.erro)
    console.log('')
    imprimirLista(jogos)
    process.exit(1)
  }

  // Decide o novo status a partir das flags (default IN_PLAY ao gravar placar).
  let novoStatus: string
  if (flags.includes('--fim')) novoStatus = 'FINISHED'
  else if (flags.includes('--pausa')) novoStatus = 'PAUSED'
  else if (flags.includes('--agendar')) novoStatus = 'SCHEDULED'
  else if (flags.includes('--vivo')) novoStatus = 'IN_PLAY'
  else novoStatus = 'IN_PLAY'

  const patch: Record<string, unknown> = { status: novoStatus, updated_at: new Date().toISOString() }

  if (novoStatus === 'SCHEDULED') {
    // Volta pra agendado: zera o placar pra não vazar parcial fantasma.
    patch.placar_casa = null
    patch.placar_fora = null
  } else if (nums.length >= 2) {
    const casa = Number(nums[0])
    const fora = Number(nums[1])
    if (!Number.isInteger(casa) || !Number.isInteger(fora) || casa < 0 || fora < 0) {
      console.error(`⚠ Placar inválido: "${nums[0]} ${nums[1]}". Use dois inteiros ≥ 0.`)
      process.exit(1)
    }
    patch.placar_casa = casa
    patch.placar_fora = fora
  } else if (nums.length === 1) {
    console.error('⚠ Informe os DOIS placares: <casa> <fora>. Ex.: bra 2 1')
    process.exit(1)
  } else {
    // Só flag, sem placar: mantém o placar atual (ex.: --pausa, --fim).
    if (alvo.placar_casa == null || alvo.placar_fora == null) {
      console.error(
        `⚠ ${alvo.time_casa} × ${alvo.time_fora} ainda não tem placar — informe <casa> <fora>.`,
      )
      process.exit(1)
    }
  }

  await rest(`/partidas?id=eq.${alvo.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  })

  // '?? alvo' só vale quando o patch NÃO mexeu no placar (undefined). Se zerou
  // pra SCHEDULED (null explícito), o sufixo fica vazio.
  const cCasa = 'placar_casa' in patch ? patch.placar_casa : alvo.placar_casa
  const cFora = 'placar_fora' in patch ? patch.placar_fora : alvo.placar_fora
  const sufixo = cCasa == null ? '' : `  ${cCasa} × ${cFora}`
  console.log(`✅ ${alvo.time_casa} × ${alvo.time_fora} → ${novoStatus}${sufixo}`)

  if (novoStatus === 'FINISHED') {
    console.log(
      'ℹ Jogo ENCERRADO. Rode "Recalcular pontuação" no /admin (ou sincronize a API)\n' +
        '  pra gravar os pontos definitivos da galera.',
    )
  } else if (AO_VIVO.has(novoStatus)) {
    console.log('ℹ Ao vivo: a UI já mostra o parcial e os pontos provisórios — sem recálculo.')
  }
}

main().catch((e) => {
  console.error('ERRO:', e instanceof Error ? e.message : e)
  process.exit(1)
})
