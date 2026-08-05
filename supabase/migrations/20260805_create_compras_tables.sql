create extension if not exists pgcrypto;

create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  categoria text,
  created_at timestamptz not null default now()
);

create table if not exists compras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  fornecedor_nome text,
  data_compra date not null,
  observacao text,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists itens_compra (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  ingrediente_id uuid not null references ingredientes(id) on delete restrict,
  ingrediente_nome text,
  quantidade numeric(12,2) not null default 0,
  unidade text not null default 'un',
  valor_unitario numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_compras_fornecedor_id on compras (fornecedor_id);
create index if not exists idx_itens_compra_compra_id on itens_compra (compra_id);
create index if not exists idx_itens_compra_ingrediente_id on itens_compra (ingrediente_id);
