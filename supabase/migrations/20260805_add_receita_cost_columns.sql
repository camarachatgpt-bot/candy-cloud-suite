ALTER TABLE IF EXISTS public.receitas
  ADD COLUMN IF NOT EXISTS rendimento numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_total numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_por_unidade numeric(12, 2) NOT NULL DEFAULT 0;
