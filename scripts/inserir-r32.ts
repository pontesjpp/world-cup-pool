// Insere partidas do R32 manualmente antes da API football-data.org populá-las.
// Usa external_id negativos como placeholder (ex: -73 para o match #73 da FIFA).
// Quando a API sincronizar e criar a linha com o external_id real, rode:
//   npx tsx scripts/inserir-r32.ts --limpar    # remove os placeholders negativos
//
// Uso:
//   npx tsx scripts/inserir-r32.ts             # lista os R32 manuais já no banco
//   npx tsx scripts/inserir-r32.ts --inserir   # insere os confrontos já definidos
//   npx tsx scripts/inserir-r32.ts --limpar    # remove placeholders negativos

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
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${REST}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`)
  return res
}

// Partidas do R32 a inserir manualmente.
// 'A definir' = time ainda não conhecido (grupo incompleto ou 3º lugar pendente).
// Atualize time_casa/time_fora e data_jogo conforme grupos fecham e calendário oficial sai.
// data_jogo: estimativas baseadas no calendário FIFA 2026.
const CONFIRMADOS = [
  // ── Confrontos completos (ambos os times conhecidos) ─────────────────────
  {
    external_id: -73,
    slot_key: 'R32-1',
    time_casa: 'South Africa',
    time_fora: 'Canada',
    data_jogo: '2026-06-29T16:00:00-03:00',
    fase: 'ROUND_OF_32',
  },
  {
    external_id: -75,
    slot_key: 'R32-3',
    time_casa: 'Netherlands',
    time_fora: 'Morocco',
    data_jogo: '2026-06-29T20:00:00-03:00',
    fase: 'ROUND_OF_32',
  },
  {
    external_id: -76,
    slot_key: 'R32-4',
    time_casa: 'Brazil',
    time_fora: 'Japan',
    data_jogo: '2026-06-30T16:00:00-03:00',
    fase: 'ROUND_OF_32',
  },
  // ── Slots parciais (um time confirmado, outro pendente) ───────────────────
  // R32-2: 1E(Germany) × 3RD — melhor 3º a definir
  {
    external_id: -74,
    slot_key: 'R32-2',
    time_casa: 'Germany',
    time_fora: 'A definir',
    data_jogo: '2026-06-29T13:00:00-03:00',
    fase: 'ROUND_OF_32',
  },
  // R32-6: 2E(Ivory Coast) × 2I — grupo I fecha hoje
  {
    external_id: -78,
    slot_key: 'R32-6',
    time_casa: 'Ivory Coast',
    time_fora: 'A definir',
    data_jogo: '2026-06-30T20:00:00-03:00',
    fase: 'ROUND_OF_32',
  },
  // R32-7: 1A(Mexico) × 3RD — melhor 3º a definir
  {
    external_id: -79,
    slot_key: 'R32-7',
    time_casa: 'Mexico',
    time_fora: 'A definir',
    data_jogo: '2026-07-01T13:00:00-03:00',
    fase: 'ROUND_OF_32',
  },
  // R32-9: 1D(United States) × 3RD — melhor 3º a definir
  {
    external_id: -81,
    slot_key: 'R32-9',
    time_casa: 'United States',
    time_fora: 'A definir',
    data_jogo: '2026-07-01T20:00:00-03:00',
    fase: 'ROUND_OF_32',
  },
  // R32-13: 1B(Switzerland) × 3RD — melhor 3º a definir
  {
    external_id: -85,
    slot_key: 'R32-13',
    time_casa: 'Switzerland',
    time_fora: 'A definir',
    data_jogo: '2026-07-02T13:00:00-03:00',
    fase: 'ROUND_OF_32',
  },
  // R32-16: 2D(Australia) × 2G — grupo G fecha amanhã
  {
    external_id: -88,
    slot_key: 'R32-16',
    time_casa: 'Australia',
    time_fora: 'A definir',
    data_jogo: '2026-07-02T20:00:00-03:00',
    fase: 'ROUND_OF_32',
  },
]

type DbPartida = {
  id: string
  external_id: number
  time_casa: string
  time_fora: string
  data_jogo: string
  status: string
  slot_key: string | null
  fase: string | null
}

async function listar() {
  const res = await rest(
    `/partidas?select=id,external_id,time_casa,time_fora,data_jogo,status,slot_key,fase&external_id=lt.0&order=external_id.asc`,
  )
  const rows = (await res.json()) as DbPartida[]
  if (rows.length === 0) {
    console.log('Nenhuma partida manual (external_id negativo) no banco.')
    return
  }
  console.log('── PARTIDAS MANUAIS (placeholders) ──')
  for (const r of rows) {
    const dt = new Date(r.data_jogo).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    console.log(`${r.slot_key?.padEnd(8) ?? '?       '}  ${dt}  ${r.time_casa} × ${r.time_fora}  [ext_id: ${r.external_id}]`)
  }
}

async function inserir() {
  for (const p of CONFIRMADOS) {
    const row = {
      external_id: p.external_id,
      time_casa: p.time_casa,
      time_fora: p.time_fora,
      data_jogo: new Date(p.data_jogo).toISOString(),
      status: 'SCHEDULED',
      fase: p.fase,
      slot_key: p.slot_key,
      updated_at: new Date().toISOString(),
    }
    await rest('/partidas?on_conflict=external_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    })
    console.log(`✅ ${p.slot_key}  ${p.time_casa} × ${p.time_fora}`)
  }
  console.log('\nPartidas inseridas. Confira no /admin e ajuste os horários quando o calendário oficial sair.')
}

async function limpar() {
  const res = await rest(
    `/partidas?select=id,external_id,time_casa,time_fora,slot_key&external_id=lt.0`,
  )
  const rows = (await res.json()) as DbPartida[]
  if (rows.length === 0) {
    console.log('Nenhum placeholder negativo para remover.')
    return
  }
  for (const r of rows) {
    // Só remove se o slot já estiver coberto por um jogo real (external_id positivo)
    const check = await rest(
      `/partidas?select=id&slot_key=eq.${r.slot_key}&external_id=gt.0`,
    )
    const real = (await check.json()) as { id: string }[]
    if (real.length > 0) {
      await rest(`/partidas?id=eq.${r.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      console.log(`🗑  ${r.slot_key}  ${r.time_casa} × ${r.time_fora}  (substituído pelo jogo real)`)
    } else {
      console.log(`⏳ ${r.slot_key}  ${r.time_casa} × ${r.time_fora}  (API ainda não tem — mantido)`)
    }
  }
}

const args = process.argv.slice(2)
if (args.includes('--inserir')) {
  inserir().catch((e) => { console.error('ERRO:', e instanceof Error ? e.message : e); process.exit(1) })
} else if (args.includes('--limpar')) {
  limpar().catch((e) => { console.error('ERRO:', e instanceof Error ? e.message : e); process.exit(1) })
} else {
  listar().catch((e) => { console.error('ERRO:', e instanceof Error ? e.message : e); process.exit(1) })
}
