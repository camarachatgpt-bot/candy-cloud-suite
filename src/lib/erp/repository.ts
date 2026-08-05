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
  DashboardTopProduto,
  Fornecedor,
  ItemEstoque,
  ItemVenda,
  Lancamento,
  Meta,
  Produto,
  ResumoDashboard,
  Venda,
} from "./types";

import { supabase } from "../supabase";

const VENDA_COLUMN_CANDIDATES = [
  "numero",
  "cliente_id",
  "cliente_nome",
  "plataforma",
  "forma_pagamento",
  "subtotal",
  "total",
  "observacoes",
  "data_venda",
] as const;

const ITEM_VENDA_COLUMN_CANDIDATES = [
  "venda_id",
  "produto_id",
  "nome_produto",
  "quantidade",
  "preco_unitario",
  "custo_unitario",
  "subtotal",
] as const;

async function empty<T>(): Promise<T[]> {
  return [];
}

function pickColumns<T extends Record<string, unknown>>(row: T, candidates: readonly string[]) {
  const nextRow: Record<string, unknown> = {};

  for (const column of candidates) {
    if (column in row && row[column] !== undefined) {
      nextRow[column] = row[column];
    }
  }

  return nextRow;
}

async function insertWithSchemaFallback(
  table: "vendas" | "itens_venda",
  rows: Array<Record<string, unknown>>,
  candidates: readonly string[],
) {
  let remainingColumns = [...candidates];
  let attemptPayload = rows.map((row) => pickColumns(row, remainingColumns));

  for (let attempt = 0; attempt < remainingColumns.length + 1; attempt += 1) {
    const { error } = await supabase.from(table).insert(attemptPayload).select();

    if (!error) {
      return;
    }

    const missingColumns = [...error.message.matchAll(/Could not find the '([^']+)' column of '([^']+)'/g)]
      .flatMap((match) => {
        const column = match[1];

        if (!column) {
          return [];
        }

        return remainingColumns.includes(column) ? [column] : [];
      });

    if (missingColumns.length === 0) {
      throw error;
    }

    for (const column of missingColumns) {
      remainingColumns = remainingColumns.filter((candidate) => candidate !== column);
    }

    attemptPayload = rows.map((row) => pickColumns(row, remainingColumns));
  }

  throw new Error(`Não foi possível persistir os registros em ${table} com as colunas disponíveis.`);
}

async function persistItensVenda(rows: Array<Record<string, unknown>>) {
  await insertWithSchemaFallback("itens_venda", rows, ITEM_VENDA_COLUMN_CANDIDATES);
}

async function buscarCustoUnitarioProduto(produtoId: string): Promise<number> {
  const { data, error } = await supabase
    .from("produtos")
    .select("preco_custo")
    .eq("id", produtoId)
    .maybeSingle();

  if (error) throw error;

  return Number(data?.preco_custo ?? 0);
}

export const erpRepository = {
  produtos: async (): Promise<Produto[]> => {
    const { data, error } = await supabase.from("produtos").select("*").order("nome");

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      sabor: item.sabor ?? null,
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
      sabor: data.sabor ?? null,
      sku: data.sku,
      preco_venda: Number(data.preco_venda ?? 0),
      custo: Number(data.preco_custo ?? 0),
      ativo: data.ativo,
      created_at: data.created_at,
    };
  },

  estoque: () => empty<ItemEstoque>(),

  clientes: async (): Promise<Cliente[]> => {
    const { data, error } = await supabase.from("clientes").select("*").order("nome");

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      telefone: item.telefone ?? null,
      email: item.email ?? null,
      cidade: item.cidade ?? null,
      created_at: item.created_at,
    }));
  },

  async createCliente(input: {
    nome: string;
    telefone: string | null;
    email: string | null;
    cidade: string | null;
  }): Promise<Cliente> {
    const { data, error } = await supabase
      .from("clientes")
      .insert([
        {
          nome: input.nome,
          telefone: input.telefone,
          email: input.email,
          cidade: input.cidade,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      nome: data.nome,
      telefone: data.telefone ?? null,
      email: data.email ?? null,
      cidade: data.cidade ?? null,
      created_at: data.created_at,
    };
  },

  fornecedores: () => empty<Fornecedor>(),

  vendas: async (): Promise<Venda[]> => {
    const { data, error } = await supabase.from("vendas").select("*").order("data_venda", {
      ascending: false,
    });

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      numero: item.numero,
      cliente_id: item.cliente_id,
      cliente_nome: item.cliente_nome,
      plataforma: item.plataforma,
      forma_pagamento: item.forma_pagamento,
      subtotal: Number(item.subtotal ?? 0),
      desconto: Number(item.desconto ?? 0),
      taxa_plataforma: Number(item.taxa_plataforma ?? 0),
      total: Number(item.total ?? 0),
      lucro_estimado: Number(item.lucro_estimado ?? 0),
      observacoes: item.observacoes ?? null,
      data_venda: item.data_venda,
    }));
  },

  async createVenda(input: {
    numero: string;
    cliente_id: string;
    cliente_nome: string;
    plataforma: Venda["plataforma"];
    forma_pagamento: Venda["forma_pagamento"];
    subtotal: number;
    desconto: number;
    taxa_plataforma: number;
    total: number;
    lucro_estimado: number;
    observacoes: string | null;
    data_venda: string;
    itens: Array<{
      produto_id: string;
      produto_nome: string;
      sabor: string | null;
      quantidade: number;
      preco_unitario: number;
      desconto: number;
      subtotal: number;
    }>;
  }): Promise<Venda> {
    const vendaPayload = {
      numero: input.numero,
      cliente_id: input.cliente_id,
      cliente_nome: input.cliente_nome,
      plataforma: input.plataforma,
      forma_pagamento: input.forma_pagamento,
      subtotal: input.subtotal,
      total: input.total,
      observacoes: input.observacoes,
      data_venda: input.data_venda,
    };

    const { data: vendaCriada, error: vendaError } = await supabase
      .from("vendas")
      .insert([vendaPayload])
      .select()
      .single();

    if (vendaError) throw vendaError;

    const vendaId = vendaCriada?.id as string | undefined;

    if (!vendaId) {
      throw new Error("Não foi possível localizar a venda criada para salvar os itens.");
    }

    const itensParaInserir = await Promise.all(
      input.itens.map(async (item) => ({
        venda_id: vendaId,
        produto_id: item.produto_id,
        nome_produto: item.produto_nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        custo_unitario: await buscarCustoUnitarioProduto(item.produto_id),
        subtotal: item.subtotal,
      })),
    );

    await persistItensVenda(itensParaInserir);

    return {
      id: vendaCriada.id,
      numero: vendaCriada.numero,
      cliente_id: vendaCriada.cliente_id,
      cliente_nome: vendaCriada.cliente_nome,
      plataforma: vendaCriada.plataforma,
      forma_pagamento: vendaCriada.forma_pagamento,
      subtotal: Number(vendaCriada.subtotal ?? 0),
      desconto: Number(vendaCriada.desconto ?? 0),
      taxa_plataforma: Number(vendaCriada.taxa_plataforma ?? 0),
      total: Number(vendaCriada.total ?? 0),
      lucro_estimado: Number(vendaCriada.lucro_estimado ?? 0),
      observacoes: vendaCriada.observacoes ?? null,
      data_venda: vendaCriada.data_venda,
    };
  },

  lancamentos: () => empty<Lancamento>(),
  metas: () => empty<Meta>(),

  async dashboardTopProdutos(): Promise<DashboardTopProduto[]> {
    const { data, error } = await supabase.from("itens_venda").select("*");

    if (error) {
      return [];
    }

    const totaisPorProduto = new Map<string, number>();

    for (const item of data ?? []) {
      const nomeProduto = String(item.nome_produto ?? item.produto_nome ?? "Produto");
      const quantidade = Number(item.quantidade ?? 0);

      if (quantidade <= 0) {
        continue;
      }

      totaisPorProduto.set(nomeProduto, (totaisPorProduto.get(nomeProduto) ?? 0) + quantidade);
    }

    return Array.from(totaisPorProduto.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, unidades]) => ({ nome, unidades }));
  },

  async resumoDashboard(): Promise<ResumoDashboard> {
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
    const fimHoje = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate() + 1,
    ).toISOString();

    try {
      const { data: vendasHoje, error: vendasHojeError } = await supabase
        .from("vendas")
        .select("id, total, lucro_estimado, data_venda")
        .gte("data_venda", inicioHoje)
        .lt("data_venda", fimHoje);

      if (vendasHojeError) {
        throw vendasHojeError;
      }

      console.log("Vendas do resumo:", vendasHoje);

      const vendasDoDia = Array.isArray(vendasHoje) ? vendasHoje : [];
      const idsVendasHoje = vendasDoDia.map((venda) => venda.id).filter(Boolean);

      const receitaHoje = vendasDoDia.reduce((soma, venda) => soma + Number(venda.total ?? 0), 0);
      const lucroHoje = vendasDoDia.reduce(
        (soma, venda) => soma + Number(venda.lucro_estimado ?? 0),
        0,
      );
      const pedidosHoje = vendasDoDia.length;

      let cookiesHoje = 0;

      if (idsVendasHoje.length > 0) {
        const { data: itensHoje, error: itensHojeError } = await supabase
          .from("itens_venda")
          .select("quantidade, venda_id")
          .in("venda_id", idsVendasHoje);

        if (!itensHojeError) {
          cookiesHoje = (Array.isArray(itensHoje) ? itensHoje : []).reduce(
            (soma, item) => soma + Number(item.quantidade ?? 0),
            0,
          );
        }
      }

      const { data: vendasTotais, error: vendasTotaisError } = await supabase
        .from("vendas")
        .select("total");

      if (vendasTotaisError) {
        throw vendasTotaisError;
      }

      const listaVendasTotais = Array.isArray(vendasTotais) ? vendasTotais : [];
      const totalVendas = listaVendasTotais.reduce((soma, venda) => soma + Number(venda.total ?? 0), 0);
      const ticketMedio = listaVendasTotais.length > 0 ? totalVendas / listaVendasTotais.length : 0;

      let metaAlvo = 0;
      let metaRealizado = 0;
      let metaMensalPercentual = 0;

      try {
        const { data: metas, error: metasError } = await supabase.from("metas").select("*");

        if (!metasError && Array.isArray(metas)) {
          const metaMes = metas.find((meta) => {
            const mesMeta = String(meta.periodo ?? "").slice(0, 7);
            return mesMeta === hoje.toISOString().slice(0, 7);
          });

          metaAlvo = Number(metaMes?.alvo ?? 0);
          metaRealizado = Number(metaMes?.realizado ?? 0);
          metaMensalPercentual = metaAlvo > 0 ? Math.min(100, Math.round((metaRealizado / metaAlvo) * 100)) : 0;
        }
      } catch {
        metaAlvo = 0;
        metaRealizado = 0;
        metaMensalPercentual = 0;
      }

      return {
        faturamento_hoje: receitaHoje,
        lucro_hoje: lucroHoje,
        pedidos_hoje: pedidosHoje,
        cookies_hoje: cookiesHoje,
        meta_mensal_percentual: metaMensalPercentual,
        meta_mensal_alvo: metaAlvo,
        meta_mensal_realizado: metaRealizado,
        estoque_critico: 0,
        ticket_medio: ticketMedio,
      };
    } catch {
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
    }
  },
};
