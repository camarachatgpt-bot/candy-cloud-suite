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

import { supabase } from "../supabase";

async function empty<T>(): Promise<T[]> {
  return [];
}

export const erpRepository = {
  produtos: async (): Promise<Produto[]> => {
    const { data, error } = await supabase.from("produtos").select("*").order("nome");

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      sabor: null,
      sku: item.sku,
      preco_venda: Number(item.preco_venda ?? 0),
      custo: Number(item.preco_custo ?? 0),
      ativo: item.ativo,
      created_at: item.created_at,
    }));
  },

  async createProduto(input: {
    nome: string;
    sku: string;
    preco_custo: number;
    preco_venda: number;
    ativo: boolean;
  }): Promise<Produto> {
    const { data, error } = await supabase
      .from("produtos")
      .insert([
        {
          nome: input.nome,
          sku: input.sku,
          preco_custo: input.preco_custo,
          preco_venda: input.preco_venda,
          ativo: input.ativo,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      nome: data.nome,
      sabor: null,
      sku: data.sku,
      preco_venda: Number(data.preco_venda ?? 0),
      custo: Number(data.preco_custo ?? 0),
      ativo: data.ativo,
      created_at: data.created_at,
    };
  },

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
