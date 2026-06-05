-- ============================================================================
-- SEED — dados estáticos de referência (rodar após schema.sql)
-- Idempotente (on conflict do update). Reexecutável.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- surpresa_elegivel — 29 seleções elegíveis (rank FIFA pré-Copa, do regulamento)
-- ATENÇÃO: `team_name` precisa casar com partidas.time_casa/time_fora (nomes da
-- football-data.org). Os nomes abaixo são os canônicos esperados em inglês; se
-- a API divergir, cadastre o mapeamento em public.team_alias após o 1º sync.
-- ----------------------------------------------------------------------------
insert into public.surpresa_elegivel (team_name, fifa_rank) values
  ('Turkey', 22),
  ('Austria', 23),
  ('Ecuador', 24),
  ('Korea Republic', 25),
  ('Australia', 27),
  ('Algeria', 28),
  ('Egypt', 29),
  ('Canada', 30),
  ('Norway', 31),
  ('Côte d''Ivoire', 33),
  ('Panama', 34),
  ('Sweden', 38),
  ('Czechia', 39),
  ('Paraguay', 40),
  ('Scotland', 43),
  ('DR Congo', 45),
  ('Tunisia', 46),
  ('Uzbekistan', 50),
  ('Qatar', 55),
  ('Iraq', 56),
  ('South Africa', 60),
  ('Saudi Arabia', 61),
  ('Jordan', 63),
  ('Bosnia and Herzegovina', 64),
  ('Cape Verde', 68),
  ('Ghana', 73),
  ('Haiti', 81),
  ('Curaçao', 83),
  ('New Zealand', 85)
on conflict (team_name) do update set fifa_rank = excluded.fifa_rank;

-- Aliases PT → canônico (e variantes comuns da API). Acrescente conforme o sync.
insert into public.team_alias (alias, canonical) values
  ('Turquia', 'Turkey'),
  ('Türkiye', 'Turkey'),
  ('Áustria', 'Austria'),
  ('Equador', 'Ecuador'),
  ('Coreia do Sul', 'Korea Republic'),
  ('South Korea', 'Korea Republic'),
  ('Austrália', 'Australia'),
  ('Argélia', 'Algeria'),
  ('Egito', 'Egypt'),
  ('Canadá', 'Canada'),
  ('Noruega', 'Norway'),
  ('Costa do Marfim', 'Côte d''Ivoire'),
  ('Ivory Coast', 'Côte d''Ivoire'),
  ('Panamá', 'Panama'),
  ('Suécia', 'Sweden'),
  ('Tchéquia', 'Czechia'),
  ('Czech Republic', 'Czechia'),
  ('Paraguai', 'Paraguay'),
  ('Escócia', 'Scotland'),
  ('RD Congo', 'DR Congo'),
  ('Congo DR', 'DR Congo'),
  ('Tunísia', 'Tunisia'),
  ('Uzbequistão', 'Uzbekistan'),
  ('Catar', 'Qatar'),
  ('Iraque', 'Iraq'),
  ('África do Sul', 'South Africa'),
  ('Arábia Saudita', 'Saudi Arabia'),
  ('Jordânia', 'Jordan'),
  ('Bósnia e Herzegovina', 'Bosnia and Herzegovina'),
  ('Bosnia-Herzegovina', 'Bosnia and Herzegovina'),
  ('Cabo Verde', 'Cape Verde'),
  ('Cape Verde Islands', 'Cape Verde'),
  ('Gana', 'Ghana'),
  ('Curaçau', 'Curaçao'),
  ('Nova Zelândia', 'New Zealand')
on conflict (alias) do update set canonical = excluded.canonical;

-- ----------------------------------------------------------------------------
-- bracket_template — chaveamento OFICIAL FIFA 2026 (partidas 73–104).
-- Pontos por LADO (home/away): R32=3, R16=6, QF=9, SF=12, 3º/Final=13.
--   R32: 16 × 2 × 3 = 96 | R16: 8×2×6=96 | QF: 4×2×9=72 | SF: 2×2×12=48
--   3º: 1×2×13=26 | Final: 1×2×13=26 | Total = 364 (confere com o regulamento).
--
-- slot_key mantém o esquema R32-n/R16-n/…; match_no carrega o nº OFICIAL da
-- partida FIFA. Os 8 vencedores que enfrentam 3ºs (placeholder '3RD') são
-- 1A,1B,1D,1E,1G,1I,1K,1L, resolvidos via src/lib/thirdPlaceMatrix.ts.
-- ----------------------------------------------------------------------------
insert into public.bracket_template
  (slot_key, round, match_no, feeds_from_home, feeds_from_away, source_home, source_away, points_per_slot)
values
  -- R32 (partidas 73–88)
  ('R32-1',  'R32', 73, null, null, '2A', '2B',  3),
  ('R32-2',  'R32', 74, null, null, '1E', '3RD', 3),
  ('R32-3',  'R32', 75, null, null, '1F', '2C',  3),
  ('R32-4',  'R32', 76, null, null, '1C', '2F',  3),
  ('R32-5',  'R32', 77, null, null, '1I', '3RD', 3),
  ('R32-6',  'R32', 78, null, null, '2E', '2I',  3),
  ('R32-7',  'R32', 79, null, null, '1A', '3RD', 3),
  ('R32-8',  'R32', 80, null, null, '1L', '3RD', 3),
  ('R32-9',  'R32', 81, null, null, '1D', '3RD', 3),
  ('R32-10', 'R32', 82, null, null, '1G', '3RD', 3),
  ('R32-11', 'R32', 83, null, null, '2K', '2L',  3),
  ('R32-12', 'R32', 84, null, null, '1H', '2J',  3),
  ('R32-13', 'R32', 85, null, null, '1B', '3RD', 3),
  ('R32-14', 'R32', 86, null, null, '1J', '2H',  3),
  ('R32-15', 'R32', 87, null, null, '1K', '3RD', 3),
  ('R32-16', 'R32', 88, null, null, '2D', '2G',  3),
  -- R16 (partidas 89–96)
  ('R16-1', 'R16', 89, 'R32-2',  'R32-5',  null, null, 6),
  ('R16-2', 'R16', 90, 'R32-1',  'R32-3',  null, null, 6),
  ('R16-3', 'R16', 91, 'R32-4',  'R32-6',  null, null, 6),
  ('R16-4', 'R16', 92, 'R32-7',  'R32-8',  null, null, 6),
  ('R16-5', 'R16', 93, 'R32-11', 'R32-12', null, null, 6),
  ('R16-6', 'R16', 94, 'R32-9',  'R32-10', null, null, 6),
  ('R16-7', 'R16', 95, 'R32-14', 'R32-16', null, null, 6),
  ('R16-8', 'R16', 96, 'R32-13', 'R32-15', null, null, 6),
  -- QF (partidas 97–100)
  ('QF-1', 'QF', 97,  'R16-1', 'R16-2', null, null, 9),
  ('QF-2', 'QF', 98,  'R16-5', 'R16-6', null, null, 9),
  ('QF-3', 'QF', 99,  'R16-3', 'R16-4', null, null, 9),
  ('QF-4', 'QF', 100, 'R16-7', 'R16-8', null, null, 9),
  -- SF (partidas 101–102)
  ('SF-1', 'SF', 101, 'QF-1', 'QF-2', null, null, 12),
  ('SF-2', 'SF', 102, 'QF-3', 'QF-4', null, null, 12),
  -- 3º lugar (perdedores das SFs, partida 103) e Final (vencedores, 104)
  ('THIRD', 'THIRD', 103, 'SF-1', 'SF-2', null, null, 13),
  ('FINAL', 'FINAL', 104, 'SF-1', 'SF-2', null, null, 13)
on conflict (slot_key) do update set
  round           = excluded.round,
  match_no        = excluded.match_no,
  feeds_from_home = excluded.feeds_from_home,
  feeds_from_away = excluded.feeds_from_away,
  source_home     = excluded.source_home,
  source_away     = excluded.source_away,
  points_per_slot = excluded.points_per_slot;

-- ----------------------------------------------------------------------------
-- third_place_matrix — tabela oficial FIFA dos 8 melhores 3ºs.
-- 12 grupos → 12 terceiros, escolher 8 = C(12,8) = 495 combinações; cada
-- `combo_key` (letras dos grupos classificados, ordenadas) mapeia os 8 terceiros
-- aos slots de 3º do R32.
--
-- ⚠️ DADO EXTERNO A SOURCEAR do apêndice oficial do bracket FIFA 2026. Enquanto
-- não preenchida, seedR32() usa um fallback determinístico (distribui os 8 3ºs
-- por ranking nos slots de 3º, em ordem) — funcional para testes, NÃO oficial.
--
-- Formato de cada linha (exemplo ilustrativo, NÃO oficial):
--   combo_key = 'ABCDEFGH'
--   assignment = {"R32-1.away":"3A","R32-2.away":"3B",...,"R32-8.away":"3H"}
-- ----------------------------------------------------------------------------
-- (intencionalmente sem linhas até obter a tabela oficial)
