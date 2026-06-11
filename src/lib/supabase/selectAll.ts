// Busca TODAS as linhas de uma query, contornando o cap padrão do PostgREST
// (~1000 linhas por request). Tabelas com várias linhas por usuário
// (palpite_classificacao = 48/usuário, palpites = 72/usuário, palpite_bracket
// = 32/usuário) estouram esse limite com poucas dezenas de participantes — sem
// paginar, os últimos usuários simplesmente somem do resultado.
//
// IMPORTANTE: sempre encadeie um .order() determinístico (idealmente pela PK)
// antes do .range(). Sem ordem explícita, o Postgres não garante a mesma ordem
// entre páginas e linhas na fronteira podem ser puladas ou duplicadas.
//
// Uso (compõe com qualquer filtro):
//   const rows = await selectAll<Row>((from, to) =>
//     supabase.from('palpite_classificacao').select('a, b')
//       .order('user_id').order('grupo').order('posicao').range(from, to))

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
