/**
 * Tipos de domínio do Candy ERP.
 * Espelham as tabelas que serão criadas no Lovable Cloud (Supabase).
 */

export type UUID = string;

export interface Produto {
  id: UUID;
  nome: string;
  sabor: string | null;
  sku: string | null;
  preco_venda: number;
  custo: number;
  ativo: boolean;
  created_at: string;
}

export interface ItemEstoque {
  id: UUID;
  insumo: string;
  unidade: string;
  quantidade: number;
  minimo: number;
  atualizado_em: string;
}

export interface Cliente {
  id: UUID;
  nome: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  created_at: string;
}

export interface Fornecedor {
  id: UUID;
  nome: string;
  contato: string | null;
  categoria: string | null;
  created_at: string;
}

export type PlataformaVenda =
  | "balcao"
  | "whatsapp"
  | "ifood"
  | "99food"
  | "instagram"
  | "delivery"
  | "site";

export type FormaPagamento = "pix" | "dinheiro" | "credito" | "debito";

export interface Venda {
  id: UUID;
  numero: string;
  cliente_id: UUID | null;
  cliente_nome: string | null;
  plataforma: PlataformaVenda;
  forma_pagamento: FormaPagamento;
  subtotal: number;
  desconto: number;
  taxa_plataforma: number;
  total: number;
  lucro_estimado: number;
  observacoes: string | null;
  data_venda: string;
}

export interface ItemVenda {
  id: UUID;
  venda_id: UUID;
  produto_id: UUID;
  produto_nome: string;
  sabor: string | null;
  quantidade: number;
  preco_unitario: number;
  desconto: number;
  subtotal: number;
  created_at: string;
}

export type TipoLancamento = "receita" | "despesa";

export interface Lancamento {
  id: UUID;
  descricao: string;
  tipo: TipoLancamento;
  valor: number;
  categoria: string | null;
  vencimento: string;
  pago: boolean;
}

export interface Meta {
  id: UUID;
  titulo: string;
  periodo: string;
  alvo: number;
  realizado: number;
}

export interface DashboardTopProduto {
  nome: string;
  unidades: number;
}

export interface ResumoDashboard {
  faturamento_hoje: number;
  lucro_hoje: number;
  pedidos_hoje: number;
  cookies_hoje: number;
  meta_mensal_percentual: number;
  meta_mensal_alvo: number;
  meta_mensal_realizado: number;
  estoque_critico: number;
  ticket_medio: number;
}
