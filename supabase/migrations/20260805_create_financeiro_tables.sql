create extension if not exists pgcrypto;

create table if not exists categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  cor text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists contas_receber (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  categoria_id uuid references categorias_financeiras(id) on delete set null,
  categoria text,
  documento text,
  origem text not null default 'Venda',
  descricao text not null,
  valor numeric(12,2) not null default 0,
  data date not null,
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'atrasado', 'cancelado')),
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists contas_pagar (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  categoria_id uuid references categorias_financeiras(id) on delete set null,
  categoria text,
  documento text,
  origem text not null default 'Compra',
  descricao text not null,
  valor numeric(12,2) not null default 0,
  data date not null,
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'atrasado', 'cancelado')),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_categorias_financeiras_tipo on categorias_financeiras (tipo);
create index if not exists idx_contas_receber_data on contas_receber (data);
create index if not exists idx_contas_pagar_data on contas_pagar (data);
create index if not exists idx_contas_receber_status on contas_receber (status);
create index if not exists idx_contas_pagar_status on contas_pagar (status);

insert into categorias_financeiras (nome, tipo, ativo)
select 'Vendas', 'receita', true
where not exists (
  select 1 from categorias_financeiras where nome = 'Vendas' and tipo = 'receita'
);

insert into categorias_financeiras (nome, tipo, ativo)
select 'Compras', 'despesa', true
where not exists (
  select 1 from categorias_financeiras where nome = 'Compras' and tipo = 'despesa'
);
