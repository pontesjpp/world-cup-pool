// Busca TODAS as linhas de uma query, contornando o cap padrão do PostgREST
// (~1000 linhas por request). Tabelas com várias linhas por usuário
// (palpite_classificacao = 48/usuário, palpites = 72/usuário, palpite_bracket
// = 32/usuário) estouram esse limite com poucas dezenas de participantes — sem
// paginar, os últimos usuários simplesmente somem do resultado.
//
// Uso (compõe com qualquer filtro):
//   const rows = await selectAll<Row>((from, to) =>
//     supabase.from('palpite_classificacao').select('a, b').range(from, to))

const PAGE = 1000

export async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}
