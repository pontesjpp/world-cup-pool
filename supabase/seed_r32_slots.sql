-- Atribui slot_keys aos 16 jogos do R32 via UPDATE direto nas partidas da API.
-- O match_no do bracket_template é o número OFICIAL do jogo FIFA:
--   R32-N => match_no = 72 + N => jogo J(72+N)
--
-- Uso: rode no SQL Editor do Supabase, depois sincronize e recalcule pontuação.
--
-- Nomes de times: football-data.org usa nomes completos em inglês.
-- Se algum UPDATE retornar 0 linhas, o nome está diferente no banco —
-- verifique com: SELECT DISTINCT time_casa, time_fora FROM partidas WHERE grupo IS NULL;

-- ── R32 com AMBOS os times confirmados ──────────────────────────────────────

-- J73 · R32-1: South Africa × Canada
UPDATE public.partidas SET slot_key = 'R32-1'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE 'South Africa' AND time_fora ILIKE 'Canada')
    OR (time_casa ILIKE 'Canada'       AND time_fora ILIKE 'South Africa'));

-- J74 · R32-2: Germany × Paraguay
UPDATE public.partidas SET slot_key = 'R32-2'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE 'Germany' AND time_fora ILIKE 'Paraguay')
    OR (time_casa ILIKE 'Paraguay' AND time_fora ILIKE 'Germany'));

-- J75 · R32-3: Netherlands × Morocco
UPDATE public.partidas SET slot_key = 'R32-3'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE 'Netherlands' AND time_fora ILIKE 'Morocco')
    OR (time_casa ILIKE 'Morocco'     AND time_fora ILIKE 'Netherlands'));

-- J76 · R32-4: Brazil × Japan
UPDATE public.partidas SET slot_key = 'R32-4'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE 'Brazil' AND time_fora ILIKE 'Japan')
    OR (time_casa ILIKE 'Japan'  AND time_fora ILIKE 'Brazil'));

-- J77 · R32-5: France × Sweden
UPDATE public.partidas SET slot_key = 'R32-5'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE 'France' AND time_fora ILIKE 'Sweden')
    OR (time_casa ILIKE 'Sweden' AND time_fora ILIKE 'France'));

-- J78 · R32-6: Ivory Coast × Norway
UPDATE public.partidas SET slot_key = 'R32-6'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE ANY(ARRAY['Ivory Coast','Côte d''Ivoire','Cote d''Ivoire']) AND time_fora ILIKE 'Norway')
    OR (time_fora ILIKE ANY(ARRAY['Ivory Coast','Côte d''Ivoire','Cote d''Ivoire']) AND time_casa ILIKE 'Norway'));

-- J79 · R32-7: Mexico × Ecuador
UPDATE public.partidas SET slot_key = 'R32-7'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE 'Mexico'  AND time_fora ILIKE 'Ecuador')
    OR (time_casa ILIKE 'Ecuador' AND time_fora ILIKE 'Mexico'));

-- J81 · R32-9: United States × Bosnia
UPDATE public.partidas SET slot_key = 'R32-9'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE ANY(ARRAY['United States','USA']) AND time_fora ILIKE ANY(ARRAY['Bosnia and Herzegovina','Bosnia-Herzegovina','Bosnia']))
    OR (time_fora ILIKE ANY(ARRAY['United States','USA']) AND time_casa ILIKE ANY(ARRAY['Bosnia and Herzegovina','Bosnia-Herzegovina','Bosnia'])));

-- J86 · R32-14: Argentina × Cabo Verde
UPDATE public.partidas SET slot_key = 'R32-14'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE 'Argentina' AND time_fora ILIKE ANY(ARRAY['Cabo Verde','Cape Verde']))
    OR (time_fora ILIKE 'Argentina' AND time_casa ILIKE ANY(ARRAY['Cabo Verde','Cape Verde'])));

-- J88 · R32-16: Australia × Egypt
UPDATE public.partidas SET slot_key = 'R32-16'
WHERE grupo IS NULL AND slot_key IS NULL
  AND ((time_casa ILIKE 'Australia' AND time_fora ILIKE 'Egypt')
    OR (time_casa ILIKE 'Egypt'     AND time_fora ILIKE 'Australia'));

-- ── R32 com UM time confirmado (placares a definir no banco) ────────────────
-- Estes jogos ainda têm um adversário indeterminado (3º colocado ou 1º/2º de
-- grupo que ainda não terminou). A atribuição agora já garante o slot quando o
-- segundo time aparecer no próximo sync.

-- J80 · R32-8: England × 3EHIJK (adversário a definir)
UPDATE public.partidas SET slot_key = 'R32-8'
WHERE grupo IS NULL AND slot_key IS NULL
  AND (time_casa ILIKE 'England' OR time_fora ILIKE 'England');

-- J81 já coberto acima (R32-9)

-- J82 · R32-10: Belgium × 3AEHIJ (adversário a definir)
UPDATE public.partidas SET slot_key = 'R32-10'
WHERE grupo IS NULL AND slot_key IS NULL
  AND (time_casa ILIKE 'Belgium' OR time_fora ILIKE 'Belgium');

-- J83 · R32-11: 2K × Croatia (2K a definir)
UPDATE public.partidas SET slot_key = 'R32-11'
WHERE grupo IS NULL AND slot_key IS NULL
  AND (time_casa ILIKE 'Croatia' OR time_fora ILIKE 'Croatia');

-- J84 · R32-12: Spain × 2J (2J a definir)
UPDATE public.partidas SET slot_key = 'R32-12'
WHERE grupo IS NULL AND slot_key IS NULL
  AND (time_casa ILIKE 'Spain' OR time_fora ILIKE 'Spain');

-- J85 · R32-13: Switzerland × 3EFGIJ (adversário a definir)
UPDATE public.partidas SET slot_key = 'R32-13'
WHERE grupo IS NULL AND slot_key IS NULL
  AND (time_casa ILIKE 'Switzerland' OR time_fora ILIKE 'Switzerland');

-- J87 · R32-15: 1K × Ghana (1K a definir)
UPDATE public.partidas SET slot_key = 'R32-15'
WHERE grupo IS NULL AND slot_key IS NULL
  AND (time_casa ILIKE 'Ghana' OR time_fora ILIKE 'Ghana');
