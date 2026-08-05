/**
 * Camada de acesso a dados do Candy ERP.
 *
 * Hoje cada função devolve uma coleção vazia (estado "Sem dados").
 * Quando o Lovable Cloud (Supabase) for habilitado, basta substituir o corpo
 * de cada função pela consulta correspondente, mantendo a mesma assinatura —
 * nenhuma tela precisará ser alterada.
 *
 * Exemplo futuro:
 *   const { data, error } = await supabase.from("produtos").select("*");
 *   if (error) throw error;
 *   return data ?? [];
 */

import type {
  Cliente,
  Fornecedor,
  ItemEstoque,
  Lancamento,
  Meta,
  Produto,
  ResumoDashboard,
  Venda,
} from "./types";

async function empty<T>(): Promise<T[]> {
  return [];
}

export const erpRepository = {
  produtos: () => empty<Produto>(),
  estoque: () => empty<ItemEstoque>(),
  clientes: () => empty<Cliente>(),
  fornecedores: () => empty<Fornecedor>(),
  vendas: () => empty<Venda>(),
  lancamentos: () => empty<Lancamento>(),
  metas: () => empty<Meta>(),

  async resumoDashboard(): Promise<ResumoDashboard> {
    return {
      faturamento_hoje: 0,
      lucro_hoje: 0,
      pedidos_hoje: 0,
      cookies_hoje: 0,
      meta_mensal_percentual: 0,
      meta_mensal_alvo: 0,
      meta_mensal_realizado: 0,
      estoque_critico: 0,
      ticket_medio: 0,
    };
  },
};
