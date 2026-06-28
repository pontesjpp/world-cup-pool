-- Migração: garante que pts_bracket existe em pontos_breakdown e que a coluna
-- `total` o inclui na soma. Necessário quando o banco foi criado antes de
-- pts_bracket ser adicionado ao schema (CREATE TABLE IF NOT EXISTS é no-op em
-- tabelas existentes e não adiciona colunas novas).
--
-- Execute este script no SQL Editor do Supabase e depois rode "Calcular pontuação"
-- no painel de admin para reprocessar todos os pontos.

-- 1) Drop na view que depende de pontos_breakdown.total
drop view if exists public.ranking;

-- 2) Adiciona pts_bracket se não existir
alter table public.pontos_breakdown add column if not exists pts_bracket int not null default 0;

-- 3) Recria a coluna `total` com a expressão correta incluindo pts_bracket
--    (PostgreSQL não permite ALTER de coluna gerada; é necessário drop + add)
alter table public.pontos_breakdown drop column if exists total;
alter table public.pontos_breakdown add column total int generated always as
  (pts_grupo_jogos + pts_mata_jogos + pts_classificacao + pts_bracket + pts_finais) stored;

-- 4) Recria a view de ranking que lê pontos_breakdown
create view public.ranking as
select
  pr.id   as user_id,
  pr.nome,
  coalesce(b.total, 0)                                   as pontos,
  coalesce(b.pts_grupo_jogos + b.pts_mata_jogos, 0)      as pts_partidas,
  coalesce(b.pts_classificacao, 0)                       as pts_grupos,
  coalesce(b.pts_bracket, 0)                             as pts_chaveamento,
  coalesce(b.pts_finais, 0)                              as pts_bonus,
  coalesce(
    (select count(*) from public.palpites pa
      where pa.user_id = pr.id and pa.categoria in ('D', 'F')),
    0
  )::int as placares_exatos
from public.profiles pr
left join public.pontos_breakdown b on b.user_id = pr.id
order by pontos desc, placares_exatos desc;

grant select on public.ranking to authenticated;
