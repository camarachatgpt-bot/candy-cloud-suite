ALTER TABLE IF EXISTS public.ingredientes
  ADD COLUMN IF NOT EXISTS preco_pago numeric(12, 2),
  ADD COLUMN IF NOT EXISTS quantidade_compra numeric(12, 3),
  ADD COLUMN IF NOT EXISTS unidade_compra text;
