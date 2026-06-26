// Gera estatísticas "soltáveis" no WhatsApp a partir dos palpites finais.
// Fala direto com a REST API do PostgREST (service-role key) — roda em Node 20.
//
// Uso:
//   npx tsx scripts/estatisticas.ts            # mostra todas as stats prontas
//   npx tsx scripts/estatisticas.ts campeao    # só a do campeão

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

// carrega .env.local (mesmo padrão de finalizar-precopa.ts)
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

// Nome no banco (inglês) → bandeira. Cobre os participantes prováveis da Copa.
const FLAG: Record<string, string> = {
  Brazil: '🇧🇷', Argentina: '🇦🇷', France: '🇫🇷', Spain: '🇪🇸', Portugal: '🇵🇹',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Germany: '🇩🇪', Netherlands: '🇳🇱', Italy: '🇮🇹', Belgium: '🇧🇪',
  Croatia: '🇭🇷', Uruguay: '🇺🇾', Colombia: '🇨🇴', Mexico: '🇲🇽', 'United States': '🇺🇸',
  Norway: '🇳🇴', Turkey: '🇹🇷', Turkiye: '🇹🇷', 'Ivory Coast': '🇨🇮', Paraguay: '🇵🇾',
  Austria: '🇦🇹', Ecuador: '🇪🇨', Czechia: '🇨🇿', Egypt: '🇪🇬', Japan: '🇯🇵',
  'South Korea': '🇰🇷', Korea: '🇰🇷', Senegal: '🇸🇳', Morocco: '🇲🇦', Switzerland: '🇨🇭',
  Denmark: '🇩🇰', Poland: '🇵🇱', Serbia: '🇷🇸', Ghana: '🇬🇭', Cameroon: '🇨🇲',
  Nigeria: '🇳🇬', Australia: '🇦🇺', Canada: '🇨🇦', 'Saudi Arabia': '🇸🇦', Qatar: '🇶🇦',
  Iran: '🇮🇷', Tunisia: '🇹🇳', Algeria: '🇩🇿', Wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Peru: '🇵🇪', Chile: '🇨🇱', Panama: '🇵🇦', 'Costa Rica': '🇨🇷', Sweden: '🇸🇪',
  Ukraine: '🇺🇦', Greece: '🇬🇷', Romania: '🇷🇴', 'New Zealand': '🇳🇿',
}

// Nome no banco (inglês) → PT-BR pra exibição.
const PT: Record<string, string> = {
  Brazil: 'Brasil', Spain: 'Espanha', France: 'França', Portugal: 'Portugal',
  England: 'Inglaterra', Germany: 'Alemanha', Netherlands: 'Holanda', Italy: 'Itália',
  Belgium: 'Bélgica', Croatia: 'Croácia', Uruguay: 'Uruguai', Colombia: 'Colômbia',
  Argentina: 'Argentina', Norway: 'Noruega', Turkey: 'Turquia', Turkiye: 'Turquia',
  'Ivory Coast': 'Costa do Marfim', Paraguay: 'Paraguai', Austria: 'Áustria',
  Ecuador: 'Equador', Czechia: 'Tchéquia', Egypt: 'Egito', Mexico: 'México',
  'United States': 'EUA', Japan: 'Japão', 'South Korea': 'Coreia do Sul',
  Senegal: 'Senegal', Morocco: 'Marrocos', Switzerland: 'Suíça', Denmark: 'Dinamarca',
  Poland: 'Polônia', Serbia: 'Sérvia', Ghana: 'Gana', Cameroon: 'Camarões',
  Nigeria: 'Nigéria', Australia: 'Austrália', Canada: 'Canadá', 'Saudi Arabia': 'Arábia Saudita',
}

const label = (name: string) => `${FLAG[name] ?? '🏳️'} ${PT[name] ?? name}`

// Faixas verticais (esq→dir) que aproximam a bandeira — usado no JPG, já que
// não há fonte de emoji colorido pra renderizar 🇧🇷 no SVG.
const FLAG_STRIPES: Record<string, string[]> = {
  Brazil: ['#009C3B', '#FFDF00', '#002776'],
  Spain: ['#AA151B', '#F1BF00', '#AA151B'],
  France: ['#0055A4', '#FFFFFF', '#EF4135'],
  Portugal: ['#006600', '#FF0000'],
  Norway: ['#BA0C2F', '#FFFFFF', '#00205B'],
  Turkey: ['#E30A17', '#FFFFFF'],
  Turkiye: ['#E30A17', '#FFFFFF'],
  'Ivory Coast': ['#F77F00', '#FFFFFF', '#009E60'],
  Ecuador: ['#FFDD00', '#034EA2', '#ED1C24'],
  Austria: ['#ED2939', '#FFFFFF', '#ED2939'],
  Paraguay: ['#D52B1E', '#FFFFFF', '#0038A8'],
  Czechia: ['#FFFFFF', '#D7141A', '#11457E'],
  Egypt: ['#CE1126', '#FFFFFF', '#000000'],
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Desenha um chip de bandeira (faixas verticais) com cantos arredondados.
function flagChip(name: string, x: number, y: number, w: number, h: number): string {
  const stripes = FLAG_STRIPES[name] ?? ['#6b7280', '#9ca3af']
  const sw = w / stripes.length
  const id = `clip-${name.replace(/\W/g, '')}`
  const rects = stripes
    .map((c, i) => `<rect x="${x + i * sw}" y="${y}" width="${sw + 0.5}" height="${h}" fill="${c}"/>`)
    .join('')
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/></clipPath>` +
    `<g clip-path="url(#${id})">${rects}</g>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>`
}

type CardOpts = {
  kicker: string
  title: string
  subtitle: string
  total: number
  entries: [string, number][]
  outPath: string
}

async function renderCard({ kicker, title, subtitle, total, entries, outPath }: CardOpts) {
  const W = 1080
  const PAD = 60
  const rowH = 118
  const headerBottom = 430
  const H = headerBottom + entries.length * rowH + 130
  const max = entries[0]?.[1] ?? 1
  const barX = 150
  const barW = W - barX - PAD
  const goldGrad = `<linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFD34E"/><stop offset="1" stop-color="#F59E0B"/></linearGradient>`
  const bg = `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d4a37"/><stop offset="1" stop-color="#06231a"/></linearGradient>`

  const rows = entries
    .map(([name, n], i) => {
      const y = headerBottom + i * rowH
      const pct = (n / total) * 100
      const filled = Math.max(28, Math.round((n / max) * barW))
      const nm = esc(PT[name] ?? name)
      return `
      <text x="${PAD}" y="${y + 34}" font-size="40" font-weight="700" fill="rgba(255,255,255,.35)" font-family="sans-serif">${i + 1}</text>
      ${flagChip(name, barX, y + 2, 92, 60)}
      <text x="${barX + 110}" y="${y + 44}" font-size="40" font-weight="700" fill="#ffffff" font-family="sans-serif">${nm}</text>
      <text x="${W - PAD}" y="${y + 44}" font-size="36" font-weight="800" fill="#FFD34E" text-anchor="end" font-family="sans-serif">${pct.toFixed(1)}% · ${n}</text>
      <rect x="${barX}" y="${y + 74}" width="${barW}" height="22" rx="11" fill="rgba(255,255,255,.10)"/>
      <rect x="${barX}" y="${y + 74}" width="${filled}" height="22" rx="11" fill="url(#gold)"/>`
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${bg}${goldGrad}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${W}" height="8" fill="url(#gold)"/>
    <text x="${PAD}" y="118" font-size="26" font-weight="700" letter-spacing="4" fill="#FFD34E" font-family="sans-serif">${esc(kicker)}</text>
    <text x="${PAD}" y="200" font-size="68" font-weight="800" fill="#ffffff" font-family="sans-serif">${esc(title)}</text>
    <text x="${PAD}" y="258" font-size="30" fill="#9fd9c0" font-family="sans-serif">${esc(subtitle)}</text>
    <rect x="${PAD - 18}" y="312" width="${36 + `${total} palpites`.length * 16}" height="40" rx="20" fill="#FFD34E"/>
    <text x="${PAD}" y="340" font-size="28" font-weight="800" fill="#06231a" font-family="sans-serif">${total} palpites</text>
    ${rows}
    <text x="${W / 2}" y="${H - 50}" font-size="26" fill="rgba(255,255,255,.5)" text-anchor="middle" font-family="sans-serif">Bolão da Copa · palpites da galera</text>
  </svg>`

  mkdirSync(new URL('./out/', import.meta.url), { recursive: true })
  await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toFile(outPath)
  return outPath
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${REST}${path}`, { headers })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

// Monta um ranking com barras proporcionais ao líder.
function bars(entries: [string, number][], total: number, width = 12): string {
  const max = entries[0]?.[1] ?? 1
  return entries
    .map(([name, n]) => {
      const pct = Math.round((n / total) * 100)
      const filled = Math.max(1, Math.round((n / max) * width))
      const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
      return `${label(name)}\n${bar} ${pct}% (${n})`
    })
    .join('\n\n')
}

function tally(rows: Record<string, unknown>[], field: string): [string, number][] {
  const m: Record<string, number> = {}
  for (const r of rows) {
    const v = r[field] as string | null
    if (v) m[v] = (m[v] ?? 0) + 1
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

async function statCampeao() {
  const fin = await getJson<Record<string, unknown>[]>(`/palpite_final?select=campeao`)
  const total = fin.filter((r) => r.campeao).length
  const ranked = tally(fin, 'campeao')

  console.log('🏆 *QUEM A TURMA ACHA QUE VAI SER CAMPEÃO* 🏆')
  console.log(`(${total} palpites enviados)\n`)
  console.log(bars(ranked, total))

  // gancho de zoeira: voto solitário
  const solo = ranked.filter(([, n]) => n === 1).map(([name]) => label(name))
  if (solo.length) {
    console.log(`\n🐐 Voto solitário (só 1 corajoso): ${solo.join(', ')}`)
  }
}

async function statZebra() {
  const fin = await getJson<Record<string, unknown>[]>(`/palpite_final?select=surpresa`)
  const total = fin.filter((r) => r.surpresa).length
  const ranked = tally(fin, 'surpresa')

  console.log('🐐 *A ZEBRA DA TURMA* 🐐')
  console.log(`(seleção surpresa mais palpitada · ${total} palpites)\n`)
  console.log(bars(ranked, total))

  const out = new URL('./out/zebra.jpg', import.meta.url).pathname
  await renderCard({
    kicker: 'BOLÃO DA COPA',
    title: 'A ZEBRA DA TURMA',
    subtitle: 'A seleção surpresa que a galera mais cravou',
    total,
    entries: ranked,
    outPath: out,
  })
  console.log(`\n🖼  JPG gerado: ${out}`)
}

async function main() {
  const which = process.argv[2]
  if (!which || which === 'campeao') await statCampeao()
  else if (which === 'zebra') await statZebra()
  else {
    console.error(`Stat desconhecida: "${which}". Disponíveis: campeao, zebra`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('ERRO:', e)
  process.exit(1)
})
