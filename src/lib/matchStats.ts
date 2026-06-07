// Estatísticas agregadas de palpites de uma partida que já começou.
// Tudo é derivado do histograma cru (partida_palpite_hist): uma linha por
// placar distinto com a quantidade de pessoas que o cravaram.

export type HistRow = {
  palpite_casa: number
  palpite_fora: number
  qtd: number
}

export type Resultado = {
  casa: number | null
  fora: number | null
}

export type PalpiteUsuario = {
  palpite_casa: number
  palpite_fora: number
} | null

export type Desfecho = 'casa' | 'empate' | 'fora'

export type VocePosicao = {
  desfecho: Desfecho
  seguiuMaioria: boolean // bateu com o desfecho mais escolhido
  // % de gente que cravou EXATAMENTE o mesmo placar que você (inclui você)
  pctMesmoPlacar: number
  cravouSozinho: boolean // foi o único com esse placar exato
} | null

export type HistogramaItem = {
  casa: number
  fora: number
  qtd: number
  pct: number // 0-100
  acertou: boolean // bate com o resultado oficial (quando há)
}

export type MatchStats = {
  total: number
  // % por desfecho (0-100), sempre somam ~100
  pctCasa: number
  pctEmpate: number
  pctFora: number
  histograma: HistogramaItem[] // ordenado por qtd desc
  placarMaisCravado: { casa: number; fora: number; qtd: number; pct: number } | null
  mediaCasa: number
  mediaFora: number
  // nº de pessoas que cravaram o placar exato (só quando o jogo tem resultado)
  exatos: number | null
  vocePosicao: VocePosicao
}

function desfechoDe(casa: number, fora: number): Desfecho {
  if (casa > fora) return 'casa'
  if (casa < fora) return 'fora'
  return 'empate'
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Agrega o histograma cru numa estrutura pronta pra UI.
 * @param hist linhas da view partida_palpite_hist (só desta partida)
 * @param resultado placar oficial; passe { casa: null, fora: null } se ainda não há
 * @param palpiteUsuario palpite do próprio usuário (pra "Você vs a galera")
 */
export function computeMatchStats(
  hist: HistRow[],
  resultado: Resultado = { casa: null, fora: null },
  palpiteUsuario: PalpiteUsuario = null,
): MatchStats {
  const total = hist.reduce((s, h) => s + h.qtd, 0)

  if (total === 0) {
    return {
      total: 0,
      pctCasa: 0,
      pctEmpate: 0,
      pctFora: 0,
      histograma: [],
      placarMaisCravado: null,
      mediaCasa: 0,
      mediaFora: 0,
      exatos: resultado.casa != null && resultado.fora != null ? 0 : null,
      vocePosicao: null,
    }
  }

  let qtdCasa = 0
  let qtdEmpate = 0
  let qtdFora = 0
  let somaCasa = 0
  let somaFora = 0
  const temResultado = resultado.casa != null && resultado.fora != null

  for (const h of hist) {
    const d = desfechoDe(h.palpite_casa, h.palpite_fora)
    if (d === 'casa') qtdCasa += h.qtd
    else if (d === 'fora') qtdFora += h.qtd
    else qtdEmpate += h.qtd
    somaCasa += h.palpite_casa * h.qtd
    somaFora += h.palpite_fora * h.qtd
  }

  const pct = (n: number) => round1((n / total) * 100)

  const histograma: HistogramaItem[] = hist
    .map((h) => ({
      casa: h.palpite_casa,
      fora: h.palpite_fora,
      qtd: h.qtd,
      pct: pct(h.qtd),
      acertou: temResultado && h.palpite_casa === resultado.casa && h.palpite_fora === resultado.fora,
    }))
    // mais cravado primeiro; desempate por placar mais "natural" (menos gols)
    .sort((a, b) => b.qtd - a.qtd || a.casa + a.fora - (b.casa + b.fora))

  const placarMaisCravado = histograma[0]
    ? {
        casa: histograma[0].casa,
        fora: histograma[0].fora,
        qtd: histograma[0].qtd,
        pct: histograma[0].pct,
      }
    : null

  const exatos = temResultado ? histograma.find((h) => h.acertou)?.qtd ?? 0 : null

  let vocePosicao: VocePosicao = null
  if (palpiteUsuario) {
    const desfecho = desfechoDe(palpiteUsuario.palpite_casa, palpiteUsuario.palpite_fora)
    const maxQtd = Math.max(qtdCasa, qtdEmpate, qtdFora)
    const qtdDesfecho = desfecho === 'casa' ? qtdCasa : desfecho === 'fora' ? qtdFora : qtdEmpate
    const meu = hist.find(
      (h) =>
        h.palpite_casa === palpiteUsuario.palpite_casa &&
        h.palpite_fora === palpiteUsuario.palpite_fora,
    )
    const qtdMesmoPlacar = meu?.qtd ?? 0
    vocePosicao = {
      desfecho,
      seguiuMaioria: qtdDesfecho === maxQtd,
      pctMesmoPlacar: pct(qtdMesmoPlacar),
      cravouSozinho: qtdMesmoPlacar === 1,
    }
  }

  return {
    total,
    pctCasa: pct(qtdCasa),
    pctEmpate: pct(qtdEmpate),
    pctFora: pct(qtdFora),
    histograma,
    placarMaisCravado,
    mediaCasa: round1(somaCasa / total),
    mediaFora: round1(somaFora / total),
    exatos,
    vocePosicao,
  }
}
