CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NULL,
  ingrediente_id uuid NOT NULL REFERENCES public.ingredientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saída', 'ajuste')),
  origem text NOT NULL CHECK (origem IN ('Venda', 'Compra', 'Ajuste')),
  documento text NULL,
  quantidade numeric(12, 2) NOT NULL DEFAULT 0,
  estoque_anterior numeric(12, 2) NOT NULL DEFAULT 0,
  estoque_posterior numeric(12, 2) NOT NULL DEFAULT 0,
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS movimentacoes_estoque_ingrediente_id_idx
  ON public.movimentacoes_estoque (ingrediente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS movimentacoes_estoque_tipo_idx
  ON public.movimentacoes_estoque (tipo, origem, created_at DESC);
