create table if not exists public.custos_fixos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid null,
  nome text not null,
  categoria text null,
  valor_mensal numeric not null default 0,
  data_vencimento date null,
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  observacao text null,
  created_at timestamptz not null default now()
);

create table if not exists public.parametros_financeiros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid null,
  taxa_ifood numeric not null default 0,
  taxa_99food numeric not null default 0,
  taxa_cartao numeric not null default 0,
  comissao numeric not null default 0,
  margem_lucro_desejada numeric not null default 0,
  percentual_perdas numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.produtos
  add column if not exists custo_receita numeric default 0,
  add column if not exists rateio_custos_fixos numeric default 0,
  add column if not exists custo_total numeric default 0,
  add column if not exists margem numeric default 0,
  add column if not exists preco_minimo numeric default 0,
  add column if not exists preco_ideal_sugerido numeric default 0;

create index if not exists custos_fixos_status_idx on public.custos_fixos (status);
create index if not exists parametros_financeiros_empresa_idx on public.parametros_financeiros (empresa_id);
