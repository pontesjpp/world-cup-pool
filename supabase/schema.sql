-- ============================================================================
-- Bolão da Copa do Mundo — Schema completo
-- Rodar no SQL Editor do Supabase (uma vez). Idempotente onde possível.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES — espelho de auth.users com nome e flag de admin
-- (criada antes da função is_admin() porque a função referencia esta tabela)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default 'Participante',
  avatar_url  text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Garante a coluna em bancos que já tinham a tabela criada antes do avatar
alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles enable row level security;

-- ----------------------------------------------------------------------------
-- Helper: checa se o usuário atual é admin (SECURITY DEFINER evita recursão RLS)
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_admin = (select is_admin from public.profiles where id = auth.uid())
  );

-- Cria automaticamente um profile quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', 'Participante'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- STORAGE — bucket público "avatars" para as fotos de perfil do cadastro
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Qualquer um pode ver os avatares (bucket público)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Usuário autenticado só pode escrever na sua própria pasta ({uid}/...)
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- PARTIDAS — jogos vindos da API externa (football-data.org)
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.match_status as enum
    ('SCHEDULED','TIMED','IN_PLAY','PAUSED','FINISHED','POSTPONED','CANCELLED');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.partidas (
  id            uuid primary key default gen_random_uuid(),
  external_id   bigint unique not null,
  time_casa     text not null,
  time_fora     text not null,
  crest_casa    text,
  crest_fora    text,
  data_jogo     timestamptz not null,
  status        public.match_status not null default 'SCHEDULED',
  placar_casa   smallint,
  placar_fora   smallint,
  fase          text,
  grupo         text,
  updated_at    timestamptz not null default now()
);

create index if not exists partidas_data_jogo_idx on public.partidas (data_jogo);

alter table public.partidas enable row level security;

drop policy if exists "partidas_select_all" on public.partidas;
create policy "partidas_select_all"
  on public.partidas for select
  to authenticated
  using (true);

drop policy if exists "partidas_admin_write" on public.partidas;
create policy "partidas_admin_write"
  on public.partidas for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- SCORING CONFIG — regras de pontuação editáveis pelo admin (linha única)
-- ----------------------------------------------------------------------------
create table if not exists public.scoring_config (
  id                   int primary key default 1,
  pontos_placar_exato  smallint not null default 10,
  pontos_resultado     smallint not null default 5,
  pontos_um_placar     smallint not null default 2,
  premiar_um_placar    boolean  not null default false,
  updated_at           timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into public.scoring_config (id) values (1) on conflict do nothing;

alter table public.scoring_config enable row level security;

drop policy if exists "config_select_all" on public.scoring_config;
create policy "config_select_all"
  on public.scoring_config for select
  to authenticated
  using (true);

drop policy if exists "config_admin_update" on public.scoring_config;
create policy "config_admin_update"
  on public.scoring_config for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- PALPITES — predições dos usuários (travadas no kickoff via RLS)
-- ----------------------------------------------------------------------------
create table if not exists public.palpites (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  partida_id      uuid not null references public.partidas(id) on delete cascade,
  palpite_casa    smallint not null check (palpite_casa between 0 and 99),
  palpite_fora    smallint not null check (palpite_fora between 0 and 99),
  pontos_obtidos  smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, partida_id)
);

create index if not exists palpites_user_idx on public.palpites (user_id);
create index if not exists palpites_partida_idx on public.palpites (partida_id);

alter table public.palpites enable row level security;

-- Cada usuário só enxerga os próprios palpites (não dá pra copiar antes do jogo)
drop policy if exists "palpites_select_own" on public.palpites;
create policy "palpites_select_own"
  on public.palpites for select
  to authenticated
  using (user_id = auth.uid());

-- NOTA: as policies de congelamento abaixo são SUBSTITUÍDAS mais adiante (seção
-- do regulamento 2026) por uma versão baseada em fase_palpite + precopa_deadline,
-- após as colunas e funções necessárias existirem. Esta versão inicial vale só
-- até aquele ponto da execução do arquivo.
drop policy if exists "palpites_insert_before_kickoff" on public.palpites;
create policy "palpites_insert_before_kickoff"
  on public.palpites for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.partidas p where p.id = partida_id and p.data_jogo > now())
  );

drop policy if exists "palpites_update_before_kickoff" on public.palpites;
create policy "palpites_update_before_kickoff"
  on public.palpites for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.partidas p where p.id = partida_id and p.data_jogo > now())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.partidas p where p.id = partida_id and p.data_jogo > now())
  );

-- ----------------------------------------------------------------------------
-- VIEW ranking — agrega pontos de todos os participantes
-- ----------------------------------------------------------------------------
create or replace view public.ranking as
select
  pr.id as user_id,
  pr.nome,
  coalesce(sum(pa.pontos_obtidos), 0)::int as pontos,
  count(*) filter (
    where pa.pontos_obtidos = (select pontos_placar_exato from public.scoring_config where id = 1)
      and pa.pontos_obtidos > 0
  )::int as placares_exatos
from public.profiles pr
left join public.palpites pa on pa.user_id = pr.id
group by pr.id, pr.nome
order by pontos desc, placares_exatos desc;

grant select on public.ranking to authenticated;

-- ----------------------------------------------------------------------------
-- FUNÇÃO recalcular_pontuacao — recomputa pontos de palpites de jogos FINISHED
-- lendo scoring_config ao vivo. Idempotente. Roda no sync e ao editar regras.
-- ----------------------------------------------------------------------------
create or replace function public.recalcular_pontuacao()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare cfg public.scoring_config%rowtype;
begin
  select * into cfg from public.scoring_config where id = 1;

  update public.palpites pal
  set pontos_obtidos = case
        when p.placar_casa = pal.palpite_casa and p.placar_fora = pal.palpite_fora
          then cfg.pontos_placar_exato
        when sign(pal.palpite_casa - pal.palpite_fora) = sign(p.placar_casa - p.placar_fora)
          then cfg.pontos_resultado
        when cfg.premiar_um_placar
             and (p.placar_casa = pal.palpite_casa or p.placar_fora = pal.palpite_fora)
          then cfg.pontos_um_placar
        else 0
      end,
      updated_at = now()
  from public.partidas p
  where pal.partida_id = p.id
    and p.status = 'FINISHED'
    and p.placar_casa is not null
    and p.placar_fora is not null;
end;
$$;

revoke all on function public.recalcular_pontuacao() from public;
grant execute on function public.recalcular_pontuacao() to authenticated;

-- ============================================================================
-- REGULAMENTO 2026 — Pré-Copa, chaveamento, pontuação multicategoria
-- (Aditivo. As colunas antigas de scoring_config seguem vivas até a Fase 2,
--  quando o motor de pontuação `recomputarTudo` substituir recalcular_pontuacao.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PARTIDAS — colunas extras para mata-mata (slot do chaveamento, placar 90', WO)
-- ----------------------------------------------------------------------------
alter table public.partidas add column if not exists slot_key       text;
alter table public.partidas add column if not exists placar_casa_90 smallint;
alter table public.partidas add column if not exists placar_fora_90 smallint;
alter table public.partidas add column if not exists anulada        boolean not null default false;

create index if not exists partidas_slot_key_idx on public.partidas (slot_key);

-- ----------------------------------------------------------------------------
-- SCORING_CONFIG — hierarquia completa + prazos (aditivo)
-- ----------------------------------------------------------------------------
alter table public.scoring_config add column if not exists pts_a               smallint not null default 3;
alter table public.scoring_config add column if not exists pts_b               smallint not null default 4;
alter table public.scoring_config add column if not exists pts_c               smallint not null default 4;
alter table public.scoring_config add column if not exists pts_d               smallint not null default 5;
alter table public.scoring_config add column if not exists pts_e               smallint not null default 3;
alter table public.scoring_config add column if not exists pts_f               smallint not null default 5;
alter table public.scoring_config add column if not exists pts_p               smallint not null default 1;
alter table public.scoring_config add column if not exists pts_solitario       smallint not null default 2;
alter table public.scoring_config add column if not exists pts_posicao         smallint not null default 1;
alter table public.scoring_config add column if not exists pts_grupo_completo  smallint not null default 3;
alter table public.scoring_config add column if not exists pts_terceiro        smallint not null default 15;
alter table public.scoring_config add column if not exists pts_vice            smallint not null default 18;
alter table public.scoring_config add column if not exists pts_campeao         smallint not null default 23;
alter table public.scoring_config add column if not exists pts_surpresa        smallint not null default 15;
alter table public.scoring_config add column if not exists precopa_deadline    timestamptz;
alter table public.scoring_config add column if not exists knockout_buffer_secs int not null default 300;

-- ----------------------------------------------------------------------------
-- PALPITES — discriminador de fase + auditoria de categoria/bônus
-- ----------------------------------------------------------------------------
alter table public.palpites add column if not exists fase_palpite text not null default 'GRUPO';
alter table public.palpites add column if not exists categoria    text;
alter table public.palpites add column if not exists solitario    boolean not null default false;
alter table public.palpites add column if not exists anulado      boolean not null default false;

do $$ begin
  alter table public.palpites
    add constraint palpites_fase_palpite_chk check (fase_palpite in ('GRUPO','MATA'));
exception when duplicate_object then null; end $$;

-- ============================================================================
-- TABELAS ESTÁTICAS DE REFERÊNCIA (seed único; leitura geral, escrita só admin)
-- ============================================================================

-- bracket_template — backbone do mata-mata (1 linha por slot)
create table if not exists public.bracket_template (
  slot_key        text primary key,        -- 'R32-1'..'FINAL'
  round           text not null,           -- 'R32','R16','QF','SF','THIRD','FINAL'
  match_no        int  not null,
  feeds_from_home text,                     -- slot da rodada anterior (R16+)
  feeds_from_away text,
  source_home     text,                     -- p/ R32: '1A','2B' ou placeholder '3rd-...'
  source_away     text,
  points_per_slot smallint not null
);
alter table public.bracket_template enable row level security;
drop policy if exists "bracket_template_select" on public.bracket_template;
create policy "bracket_template_select" on public.bracket_template
  for select to authenticated using (true);
drop policy if exists "bracket_template_admin" on public.bracket_template;
create policy "bracket_template_admin" on public.bracket_template
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- third_place_matrix — tabela oficial FIFA dos 8 melhores 3ºs
create table if not exists public.third_place_matrix (
  combo_key   text primary key,            -- letras dos grupos classificados, ordenadas
  assignment  jsonb not null               -- { "R32-3.away": "3C", ... }
);
alter table public.third_place_matrix enable row level security;
drop policy if exists "third_place_matrix_select" on public.third_place_matrix;
create policy "third_place_matrix_select" on public.third_place_matrix
  for select to authenticated using (true);
drop policy if exists "third_place_matrix_admin" on public.third_place_matrix;
create policy "third_place_matrix_admin" on public.third_place_matrix
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- surpresa_elegivel — 29 seleções elegíveis a "surpresa" + rank FIFA pré-Copa
create table if not exists public.surpresa_elegivel (
  team_name  text primary key,
  fifa_rank  smallint not null
);
alter table public.surpresa_elegivel enable row level security;
drop policy if exists "surpresa_elegivel_select" on public.surpresa_elegivel;
create policy "surpresa_elegivel_select" on public.surpresa_elegivel
  for select to authenticated using (true);
drop policy if exists "surpresa_elegivel_admin" on public.surpresa_elegivel;
create policy "surpresa_elegivel_admin" on public.surpresa_elegivel
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- team_alias — normaliza nomes da API ↔ tabelas estáticas (opcional)
create table if not exists public.team_alias (
  alias        text primary key,           -- nome como vem da football-data.org
  canonical    text not null               -- nome canônico usado nas tabelas estáticas
);
alter table public.team_alias enable row level security;
drop policy if exists "team_alias_select" on public.team_alias;
create policy "team_alias_select" on public.team_alias
  for select to authenticated using (true);
drop policy if exists "team_alias_admin" on public.team_alias;
create policy "team_alias_admin" on public.team_alias
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- TABELAS DE PALPITE PRÉ-COPA (congelam no precopa_deadline)
-- ============================================================================

-- Helper: prazo da pré-copa já passou?
create or replace function public.precopa_fechada()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce(
    (select precopa_deadline from public.scoring_config where id = 1) <= now(),
    false
  );
$$;

-- Congelamento de palpites: GRUPO trava no precopa_deadline; MATA trava a
-- (kickoff − knockout_buffer_secs). Substitui as policies iniciais de palpites.
create or replace function public.palpite_editavel(p_partida_id uuid, p_fase text)
returns boolean language sql security definer set search_path = public stable as $$
  select case
    when p_fase = 'GRUPO' then not public.precopa_fechada()
    else exists (
      select 1 from public.partidas p
      where p.id = p_partida_id
        and p.data_jogo - make_interval(
              secs => coalesce((select knockout_buffer_secs from public.scoring_config where id = 1), 300)
            ) > now()
    )
  end;
$$;

drop policy if exists "palpites_insert_before_kickoff" on public.palpites;
create policy "palpites_insert_before_kickoff"
  on public.palpites for insert
  to authenticated
  with check (user_id = auth.uid() and public.palpite_editavel(partida_id, fase_palpite));

drop policy if exists "palpites_update_before_kickoff" on public.palpites;
create policy "palpites_update_before_kickoff"
  on public.palpites for update
  to authenticated
  using (user_id = auth.uid() and public.palpite_editavel(partida_id, fase_palpite))
  with check (user_id = auth.uid() and public.palpite_editavel(partida_id, fase_palpite));

-- precopa_status — flag de envio + carimbo
create table if not exists public.precopa_status (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  submitted    boolean not null default false,
  submitted_at timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.precopa_status enable row level security;
drop policy if exists "precopa_status_select_own" on public.precopa_status;
create policy "precopa_status_select_own" on public.precopa_status
  for select to authenticated
  using (user_id = auth.uid() or public.precopa_fechada());
drop policy if exists "precopa_status_write_own" on public.precopa_status;
create policy "precopa_status_write_own" on public.precopa_status
  for all to authenticated
  using (user_id = auth.uid() and not public.precopa_fechada())
  with check (user_id = auth.uid() and not public.precopa_fechada());

-- palpite_classificacao — classificação derivada dos placares de grupo
create table if not exists public.palpite_classificacao (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  grupo          text not null,
  posicao        smallint not null check (posicao between 1 and 4),
  time           text not null,
  pontos_grupo   smallint,
  saldo          smallint,
  gols_pro       smallint,
  pontos_obtidos smallint not null default 0,
  primary key (user_id, grupo, posicao)
);
alter table public.palpite_classificacao enable row level security;
drop policy if exists "palpite_classificacao_select" on public.palpite_classificacao;
create policy "palpite_classificacao_select" on public.palpite_classificacao
  for select to authenticated
  using (user_id = auth.uid() or public.precopa_fechada());
drop policy if exists "palpite_classificacao_write" on public.palpite_classificacao;
create policy "palpite_classificacao_write" on public.palpite_classificacao
  for all to authenticated
  using (user_id = auth.uid() and not public.precopa_fechada())
  with check (user_id = auth.uid() and not public.precopa_fechada());

-- palpite_bracket — quem o usuário fez avançar de cada slot
create table if not exists public.palpite_bracket (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  slot_key       text not null references public.bracket_template(slot_key),
  time           text not null,
  pontos_obtidos smallint not null default 0,
  acertou        boolean not null default false,
  primary key (user_id, slot_key)
);
alter table public.palpite_bracket enable row level security;
drop policy if exists "palpite_bracket_select" on public.palpite_bracket;
create policy "palpite_bracket_select" on public.palpite_bracket
  for select to authenticated
  using (user_id = auth.uid() or public.precopa_fechada());
drop policy if exists "palpite_bracket_write" on public.palpite_bracket;
create policy "palpite_bracket_write" on public.palpite_bracket
  for all to authenticated
  using (user_id = auth.uid() and not public.precopa_fechada())
  with check (user_id = auth.uid() and not public.precopa_fechada());

-- palpite_final — campeão / vice / 3º / surpresa
create table if not exists public.palpite_final (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  campeao         text,
  vice            text,
  terceiro        text,
  surpresa        text,
  pontos_campeao  smallint not null default 0,
  pontos_vice     smallint not null default 0,
  pontos_terceiro smallint not null default 0,
  pontos_surpresa smallint not null default 0
);
alter table public.palpite_final enable row level security;
drop policy if exists "palpite_final_select" on public.palpite_final;
create policy "palpite_final_select" on public.palpite_final
  for select to authenticated
  using (user_id = auth.uid() or public.precopa_fechada());
drop policy if exists "palpite_final_write" on public.palpite_final;
create policy "palpite_final_write" on public.palpite_final
  for all to authenticated
  using (user_id = auth.uid() and not public.precopa_fechada())
  with check (user_id = auth.uid() and not public.precopa_fechada());

-- pontos_breakdown — cache de pontos por categoria (alimentado pelo motor Fase 2)
create table if not exists public.pontos_breakdown (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  pts_grupo_jogos   int not null default 0,
  pts_mata_jogos    int not null default 0,
  pts_classificacao int not null default 0,
  pts_bracket       int not null default 0,
  pts_finais        int not null default 0,
  total             int generated always as
    (pts_grupo_jogos + pts_mata_jogos + pts_classificacao + pts_bracket + pts_finais) stored,
  updated_at        timestamptz not null default now()
);
alter table public.pontos_breakdown enable row level security;
drop policy if exists "pontos_breakdown_select_all" on public.pontos_breakdown;
create policy "pontos_breakdown_select_all" on public.pontos_breakdown
  for select to authenticated using (true);
-- escrita só via service-role (motor de pontuação); sem policy de write p/ usuários.

-- ----------------------------------------------------------------------------
-- VIEW ranking (v2) — lê pontos_breakdown (motor multicategoria) com subtotais.
-- Mantém colunas `pontos` e `placares_exatos` p/ compatibilidade com a UI atual.
-- (drop + create porque a ordem/colunas mudam — create or replace não permite.)
-- ----------------------------------------------------------------------------
drop view if exists public.ranking;
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

-- ----------------------------------------------------------------------------
-- TABLE ranking_snapshot — posição anterior de cada participante, gravada no
-- início de cada recomputarTudo(). Usada para exibir movimentação no ranking.
-- ----------------------------------------------------------------------------
create table if not exists public.ranking_snapshot (
  user_id     uuid     not null references public.profiles(id) on delete cascade,
  posicao     smallint not null,
  pontos      integer  not null,
  snapshot_at timestamptz not null default now(),
  primary key (user_id)
);
alter table public.ranking_snapshot enable row level security;
drop policy if exists "ranking_snapshot_select" on public.ranking_snapshot;
create policy "ranking_snapshot_select" on public.ranking_snapshot
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- VIEW partida_palpite_hist — histograma agregado de palpites por partida.
-- Como o RLS de `palpites` esconde o palpite alheio (palpites_select_own),
-- esta view (owner = postgres, igual à `ranking`) agrega TODOS os palpites,
-- mas só EXPÕE um jogo depois que o palpite dele JÁ TRAVOU, pra não vazar
-- tendência antes do prazo. Devolve só contagens — nunca quem palpitou o quê.
-- A UI deriva o resto (%, média, placar mais cravado, cravadas) deste grão.
--
-- Janela de liberação (alinhada à trava do palpite, ver palpite_editavel):
--   • GRUPO  → palpite trava na pré-copa; liberamos as stats 1h antes do apito.
--   • MATA   → palpite trava em (apito − knockout_buffer_secs); liberamos junto,
--              pra não dar tempo de copiar o palpite alheio.
-- ----------------------------------------------------------------------------
drop view if exists public.partida_palpite_hist;
create view public.partida_palpite_hist as
select
  pa.partida_id,
  pa.palpite_casa,
  pa.palpite_fora,
  count(*)::int as qtd
from public.palpites pa
join public.partidas p on p.id = pa.partida_id
where (
    case
      when nullif(p.grupo, '') is not null
        then p.data_jogo - interval '1 hour' <= now()
      else p.data_jogo - make_interval(
             secs => coalesce((select knockout_buffer_secs from public.scoring_config where id = 1), 300)
           ) <= now()
    end
  )
  and coalesce(pa.anulado, false) = false
group by pa.partida_id, pa.palpite_casa, pa.palpite_fora;

grant select on public.partida_palpite_hist to authenticated;

-- ----------------------------------------------------------------------------
-- VIEW partida_palpites_galera — palpites NOMINAIS por partida (quem cravou o
-- quê + pontos). Espelha a privacidade de partida_palpite_hist: owner = postgres
-- (bypassa o RLS palpites_select_own) mas só EXPÕE jogos cujo apito já rolou
-- (data_jogo <= now()), pra não vazar o palpite alheio antes do prazo.
-- `pontos_obtidos` só é fiel em jogos FINISHED (gravado por recomputarTudo); em
-- jogos ao vivo a UI recalcula os pontos provisórios contra o placar parcial.
-- ----------------------------------------------------------------------------
drop view if exists public.partida_palpites_galera;
create view public.partida_palpites_galera as
select
  pa.partida_id,
  pa.user_id,
  pr.nome,
  pr.avatar_url,
  pa.palpite_casa,
  pa.palpite_fora,
  pa.pontos_obtidos,
  pa.categoria,
  pa.solitario
from public.palpites pa
join public.partidas p on p.id = pa.partida_id
join public.profiles pr on pr.id = pa.user_id
where p.data_jogo <= now()
  and coalesce(pa.anulado, false) = false;

grant select on public.partida_palpites_galera to authenticated;

-- ============================================================================
-- Após rodar: marque seu usuário como admin com:
--   update public.profiles set is_admin = true where id = '<SEU_AUTH_UID>';
-- ============================================================================
