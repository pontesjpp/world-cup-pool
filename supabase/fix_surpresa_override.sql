-- Adiciona campos de override manual para os bônus finais.
-- Quando preenchidos, substituem o cálculo automático pelo resultado das partidas.
alter table public.scoring_config
  add column if not exists surpresa_override  text default null,
  add column if not exists campeao_override   text default null,
  add column if not exists vice_override      text default null,
  add column if not exists terceiro_override  text default null;
