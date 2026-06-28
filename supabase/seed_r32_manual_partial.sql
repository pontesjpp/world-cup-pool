-- Registros manuais (external_id < 0) para os 6 confrontos do R32 que têm
-- apenas UM time confirmado na API. Quando o segundo time for definido e a
-- próxima sincronização rodar, o slot_key será transferido automaticamente
-- para o registro da API e este registro manual será removido.
--
-- Execute no SQL Editor do Supabase.

INSERT INTO public.partidas
  (external_id, slot_key, time_casa, time_fora, data_jogo, status, fase, grupo, anulada, updated_at)
VALUES
  -- J74 · R32-2: Germany × ? (adversário a definir)
  (-74,  'R32-2',  'Germany',     'a definir', '2026-06-29 20:30:00+00', 'TIMED', 'LAST_32', NULL, false, now()),
  -- J78 · R32-6: Ivory Coast × ? (adversário a definir)
  (-78,  'R32-6',  'Ivory Coast', 'a definir', '2026-06-30 17:00:00+00', 'TIMED', 'LAST_32', NULL, false, now()),
  -- J79 · R32-7: Mexico × ? (adversário a definir)
  (-79,  'R32-7',  'Mexico',      'a definir', '2026-07-01 01:00:00+00', 'TIMED', 'LAST_32', NULL, false, now()),
  -- J85 · R32-13: Switzerland × ? (adversário a definir)
  (-85,  'R32-13', 'Switzerland', 'a definir', '2026-07-03 03:00:00+00', 'TIMED', 'LAST_32', NULL, false, now()),
  -- J86 · R32-14: Argentina × ? (adversário a definir)
  (-86,  'R32-14', 'Argentina',   'a definir', '2026-07-03 22:00:00+00', 'TIMED', 'LAST_32', NULL, false, now()),
  -- J88 · R32-16: Australia × ? (adversário a definir)
  (-88,  'R32-16', 'Australia',   'a definir', '2026-07-03 18:00:00+00', 'TIMED', 'LAST_32', NULL, false, now())
ON CONFLICT (external_id) DO UPDATE SET
  slot_key   = EXCLUDED.slot_key,
  time_casa  = EXCLUDED.time_casa,
  updated_at = now();
