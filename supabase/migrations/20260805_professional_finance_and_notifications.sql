alter table contas_pagar
  add column if not exists data_emissao date,
  add column if not exists data_vencimento date,
  add column if not exists valor_total numeric default 0,
  add column if not exists valor_pago numeric default 0,
  add column if not exists valor_aberto numeric default 0,
  add column if not exists forma_pagamento text,
  add column if not exists numero_parcela integer,
  add column if not exists total_parcelas integer,
  add column if not exists observacao text;

alter table contas_receber
  add column if not exists data_emissao date,
  add column if not exists data_vencimento date,
  add column if not exists valor_total numeric default 0,
  add column if not exists valor_recebido numeric default 0,
  add column if not exists valor_aberto numeric default 0,
  add column if not exists forma_recebimento text,
  add column if not exists numero_parcela integer,
  add column if not exists total_parcelas integer,
  add column if not exists observacao text;

create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  titulo text not null,
  descricao text not null,
  prioridade text not null default 'media',
  lida boolean not null default false,
  data date not null default current_date,
  origem text not null default 'sistema',
  valor numeric default 0,
  data_vencimento date,
  dias_restantes integer,
  link text,
  referencia_id uuid,
  referencia_tipo text,
  created_at timestamptz not null default now()
);

update contas_pagar
set
  valor_total = coalesce(valor_total, valor),
  valor_pago = coalesce(valor_pago, case when status = 'pago' then valor else 0 end),
  valor_aberto = coalesce(valor_aberto, greatest(coalesce(valor_total, valor) - coalesce(valor_pago, case when status = 'pago' then valor else 0 end), 0));

update contas_receber
set
  valor_total = coalesce(valor_total, valor),
  valor_recebido = coalesce(valor_recebido, case when status = 'recebido' then valor else 0 end),
  valor_aberto = coalesce(valor_aberto, greatest(coalesce(valor_total, valor) - coalesce(valor_recebido, case when status = 'recebido' then valor else 0 end), 0));

insert into notificacoes (tipo, titulo, descricao, prioridade, lida, data, origem)
select 'conta_vencida', 'Conta vencida', 'Há contas financeiras vencidas aguardando atualização.', 'alta', false, current_date, 'financeiro'
where not exists (select 1 from notificacoes where tipo = 'conta_vencida');

insert into notificacoes (tipo, titulo, descricao, prioridade, lida, data, origem)
select 'conta_vencendo', 'Conta vencendo em breve', 'Algumas contas vencem nos próximos 7 dias.', 'media', false, current_date, 'financeiro'
where not exists (select 1 from notificacoes where tipo = 'conta_vencendo');
