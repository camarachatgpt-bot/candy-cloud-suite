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
  custo_receita?: number;
  rateio_custos_fixos?: number;
  custo_total?: number;
  margem?: number;
  margem_atual?: number;
  preco_minimo?: number;
  preco_ideal_sugerido?: number;
  preco_recomendado?: number;
  ativo: boolean;
  created_at: string;
}

export interface CustoFixo {
  id: UUID;
  empresa_id?: UUID | null;
  nome: string;
  categoria: string | null;
  valor_mensal: number;
  data_vencimento: string | null;
  status: "Ativo" | "Inativo";
  observacao: string | null;
  created_at: string;
}

export interface ParametrosFinanceiros {
  id: UUID | null;
  empresa_id?: UUID | null;
  taxa_ifood: number;
  taxa_99food: number;
  taxa_cartao: number;
  comissao: number;
  margem_lucro_desejada: number;
  percentual_perdas: number;
  meta_mensal_vendas_unidades: number;
  created_at: string | null;
}

export interface ItemEstoque {
  id: UUID;
  insumo: string;
  categoria?: string | null;
  unidade: string;
  quantidade: number;
  minimo: number;
  observacao?: string | null;
  atualizado_em: string;
}

export interface MovimentacaoEstoque {
  id: UUID;
  empresa_id: UUID | null;
  ingrediente_id: UUID;
  tipo: "entrada" | "saída" | "ajuste";
  origem: "Venda" | "Compra" | "Ajuste";
  documento: string | null;
  quantidade: number;
  estoque_anterior: number;
  estoque_posterior: number;
  observacao: string | null;
  created_at: string;
}

export interface Ingrediente {
  id: UUID;
  empresa_id: UUID | null;
  nome: string;
  categoria: string | null;
  unidade: string;
  quantidade: number;
  estoque_minimo: number;
  custo_unitario: number;
  fornecedor: string | null;
  observacao?: string | null;
  ativo: boolean;
  created_at: string;
}

export interface ReceitaIngrediente {
  id: UUID;
  ingrediente_id: UUID;
  nome: string;
  unidade: string;
  quantidade: number;
  custo_unitario: number;
}

export interface Receita {
  id: UUID;
  empresa_id: UUID | null;
  produto_id: UUID;
  produto_nome: string;
  rendimento: number;
  custo_total: number;
  custo_por_unidade: number;
  ingredientes: ReceitaIngrediente[];
  ativo: boolean;
  created_at: string;
}

export interface Cliente {
  id: UUID;
  nome: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  data_nascimento?: string | null;
  created_at: string;
}

export interface Fornecedor {
  id: UUID;
  nome: string;
  contato: string | null;
  categoria: string | null;
  created_at: string;
}

export interface CategoriaFinanceira {
  id: UUID;
  nome: string;
  tipo: "receita" | "despesa";
  cor: string | null;
  ativo: boolean;
  created_at: string;
}

export type StatusContaPagar = "Pendente" | "Parcial" | "Pago" | "Vencido";
export type StatusContaReceber = "Pendente" | "Parcial" | "Recebido" | "Vencido";

export interface ContaReceber {
  id: UUID;
  empresa_id: UUID | null;
  categoria_id: UUID | null;
  categoria: string | null;
  documento: string | null;
  origem: string;
  descricao: string;
  valor: number;
  data: string;
  status: StatusContaReceber;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_recebimento: string | null;
  valor_total: number;
  valor_recebido: number;
  valor_aberto: number;
  forma_recebimento: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  observacao: string | null;
  created_at: string;
}

export interface ContaPagar {
  id: UUID;
  empresa_id: UUID | null;
  categoria_id: UUID | null;
  categoria: string | null;
  documento: string | null;
  origem: string;
  descricao: string;
  valor: number;
  data: string;
  status: StatusContaPagar;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor_total: number;
  valor_pago: number;
  valor_aberto: number;
  forma_pagamento: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  observacao: string | null;
  created_at: string;
}

export interface ItemCompra {
  id: UUID;
  compra_id: UUID;
  ingrediente_id: UUID;
  ingrediente_nome: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  created_at: string;
}

export interface Compra {
  id: UUID;
  empresa_id: UUID | null;
  fornecedor_id: UUID | null;
  fornecedor_nome: string | null;
  data_compra: string;
  observacao: string | null;
  total: number;
  tipo_pagamento?: TipoPagamentoCompra | null;
  forma_pagamento?: string | null;
  data_pagamento?: string | null;
  observacao_pagamento?: string | null;
  parcelamento?: { parcelas: number; intervaloDias: number } | null;
  created_at: string;
  itens?: ItemCompra[];
}

export type PlataformaVenda =
  | "balcao"
  | "whatsapp"
  | "ifood"
  | "99food"
  | "instagram"
  | "delivery"
  | "site";

export type TipoPagamentoCompra = "avista" | "prazo";
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

export interface DashboardFinanceiro {
  receitas_do_mes: number;
  despesas_do_mes: number;
  saldo: number;
  lucro_liquido: number;
  contas_a_pagar: number;
  contas_a_receber: number;
  contas_vencidas: number;
  contas_vencendo_7_dias: number;
  total_em_aberto: number;
  total_recebido: number;
  total_pago: number;
}

export interface DashboardCustosFixos {
  compras_mes: number;
  custos_fixos_mes: number;
  produtos_vendidos_mes: number;
  percentual_custos_fixos_sobre_faturamento: number;
  rateio_custos_fixos_por_produto: number;
  faturamento_mes: number;
  lucro_bruto: number;
  lucro_liquido: number;
  margem_liquida: number;
  ponto_equilibrio: number;
}

export interface DashboardAlerta {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
  link: string;
  valor?: number | null;
}

export interface Notificacao {
  id: UUID;
  tipo: string;
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
  lida: boolean;
  data: string;
  origem: string;
  valor?: number | null;
  data_vencimento?: string | null;
  dias_restantes?: number | null;
  link?: string | null;
  referencia_id?: string | null;
  referencia_tipo?: string | null;
  created_at: string;
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
  produtos_vendidos_hoje: number;
  pedidos_ifood_hoje: number;
  pedidos_balcao_hoje: number;
  meta_mensal_percentual: number;
  meta_mensal_alvo: number;
  meta_mensal_realizado: number;
  estoque_critico: number;
  contas_a_receber: number;
  contas_a_pagar: number;
  caixa_disponivel: number;
  ticket_medio: number;
  margem_media_produtos: number;
  produto_mais_lucrativo: { nome: string; margem: number } | null;
  produto_mais_abaixo_do_minimo: { nome: string; diferenca: number } | null;
}
