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
  CategoriaFinanceira,
  Cliente,
  Compra,
  ContaPagar,
  ContaReceber,
  DashboardFinanceiro,
  DashboardTopProduto,
  Fornecedor,
  Ingrediente,
  ItemCompra,
  ItemEstoque,
  ItemVenda,
  Lancamento,
  Meta,
  MovimentacaoEstoque,
  Produto,
  Receita,
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

async function registrarMovimentacaoEstoque(input: {
  empresa_id: string | null;
  ingrediente_id: string;
  tipo: "entrada" | "saída" | "ajuste";
  origem: "Venda" | "Compra" | "Ajuste";
  documento: string | null;
  quantidade: number;
  estoque_anterior: number;
  estoque_posterior: number;
  observacao: string | null;
}): Promise<void> {
  const { error } = await supabase.from("movimentacoes_estoque").insert([
    {
      empresa_id: input.empresa_id,
      ingrediente_id: input.ingrediente_id,
      tipo: input.tipo,
      origem: input.origem,
      documento: input.documento,
      quantidade: input.quantidade,
      estoque_anterior: input.estoque_anterior,
      estoque_posterior: input.estoque_posterior,
      observacao: input.observacao,
    },
  ]);

  if (error) throw error;
}

async function recalcularReceitasPorIngrediente(ingredienteId: string): Promise<void> {
  const { data: receitasRelacionadas, error: receitasRelacionadasError } = await supabase
      .from("receitas")
      .select("id, produto_id")
      .eq("ingrediente_id", ingredienteId);
  if (receitasRelacionadasError) throw receitasRelacionadasError;

  const produtoIds = [...new Set((receitasRelacionadas ?? []).map((item) => item.produto_id as string).filter(Boolean))];

  if (produtoIds.length === 0) {
    return;
  }

  const { data: receitasPorProduto, error: receitasPorProdutoError } = await supabase
    .from("receitas")
    .select("id, produto_id, ingrediente_id, quantidade, rendimento")
    .in("produto_id", produtoIds);

  if (receitasPorProdutoError) throw receitasPorProdutoError;

  const receitasAgrupadas = new Map<string, Array<Record<string, unknown>>>();

  for (const receita of receitasPorProduto ?? []) {
    const produtoId = receita.produto_id as string;
    const linhas = receitasAgrupadas.get(produtoId) ?? [];
    linhas.push(receita);
    receitasAgrupadas.set(produtoId, linhas);
  }

  const ingredientesIds = [...new Set((receitasPorProduto ?? []).map((item) => item.ingrediente_id as string).filter(Boolean))];

  if (ingredientesIds.length > 0) {
    const { data: ingredientes, error: ingredientesError } = await supabase
      .from("ingredientes")
      .select("id, custo_unitario")
      .in("id", ingredientesIds);

    if (ingredientesError) throw ingredientesError;

    const custosPorIngrediente = new Map<string, number>(
      (ingredientes ?? []).map((item) => [item.id as string, Number(item.custo_unitario ?? 0)]),
    );

    for (const [produtoId, linhas] of receitasAgrupadas.entries()) {
      const rendimento = Number((linhas[0] as Record<string, unknown>)?.["rendimento"] ?? 0);
      const custoTotal = linhas.reduce((total, linha) => {
        const ingredienteId = (linha as Record<string, unknown>)["ingrediente_id"] as string;
        const custoUnitario = custosPorIngrediente.get(ingredienteId) ?? 0;
        return total + custoUnitario * Number((linha as Record<string, unknown>)["quantidade"] ?? 0);
      }, 0);
      const custoPorUnidade = rendimento > 0 ? custoTotal / rendimento : custoTotal;

      await Promise.all(
        linhas.map((linha) =>
          supabase
            .from("receitas")
            .update({
              custo_total: custoTotal,
              custo_por_unidade: custoPorUnidade,
            })
            .eq("id", (linha as Record<string, unknown>)["id"] as string),
        ),
      );

      const { error: updateProdutoError } = await supabase
        .from("produtos")
        .update({ preco_custo: custoPorUnidade })
        .eq("id", produtoId);

      if (updateProdutoError) throw updateProdutoError;
    }
  }
}

async function calcularBaixaEstoqueVenda(
  itens: Array<{
    produto_id: string;
    quantidade: number;
  }>,
): Promise<Map<string, number>> {
  const receitasPorProduto = await Promise.all(
    itens.map(async (item) => {
      const { data, error } = await supabase
        .from("receitas")
        .select("ingrediente_id, quantidade, rendimento")
        .eq("produto_id", item.produto_id);

      if (error) throw error;

      return (data ?? []).map((receita) => ({
        ingrediente_id: receita.ingrediente_id as string,
        quantidade: Number(receita.quantidade ?? 0),
        rendimento: Number(receita.rendimento ?? 0),
        quantidadeVendida: Number(item.quantidade ?? 0),
      }));
    }),
  );

  const reducoesPorIngrediente = new Map<string, number>();

  for (const receitas of receitasPorProduto) {
    for (const receita of receitas) {
      if (!receita.ingrediente_id || receita.rendimento <= 0 || receita.quantidade <= 0) {
        continue;
      }

      const quantidadeParaBaixar = (receita.quantidade / receita.rendimento) * receita.quantidadeVendida;
      const quantidadeAtual = reducoesPorIngrediente.get(receita.ingrediente_id) ?? 0;
      reducoesPorIngrediente.set(receita.ingrediente_id, quantidadeAtual + quantidadeParaBaixar);
    }
  }

  const ingredienteIds = [...reducoesPorIngrediente.keys()];

  if (ingredienteIds.length === 0) {
    return reducoesPorIngrediente;
  }

  const { data: ingredientes, error: ingredientesError } = await supabase
    .from("ingredientes")
    .select("id, nome, quantidade")
    .in("id", ingredienteIds);

  if (ingredientesError) throw ingredientesError;

  for (const ingrediente of ingredientes ?? []) {
    const ingredienteId = ingrediente.id as string;
    const quantidadeNecessaria = reducoesPorIngrediente.get(ingredienteId) ?? 0;
    const quantidadeDisponivel = Number(ingrediente.quantidade ?? 0);

    if (quantidadeDisponivel < quantidadeNecessaria) {
      throw new Error(
        `Estoque insuficiente para ${ingrediente.nome ?? "ingrediente"}. Disponível: ${quantidadeDisponivel}. Necessário: ${quantidadeNecessaria}.`,
      );
    }
  }

  return reducoesPorIngrediente;
}

async function aplicarBaixaEstoqueVenda(
  vendaId: string,
  reducoesPorIngrediente: Map<string, number>,
): Promise<void> {
  for (const [ingredienteId, quantidadeParaBaixar] of reducoesPorIngrediente.entries()) {
    const { data: ingredienteAtual, error: ingredienteError } = await supabase
      .from("ingredientes")
      .select("quantidade, nome")
      .eq("id", ingredienteId)
      .maybeSingle();

    if (ingredienteError) throw ingredienteError;

    const estoqueAnterior = Number(ingredienteAtual?.quantidade ?? 0);
    const estoquePosterior = estoqueAnterior - quantidadeParaBaixar;

    if (estoqueAnterior < quantidadeParaBaixar) {
      throw new Error(
        `Estoque insuficiente para ${ingredienteAtual?.nome ?? "ingrediente"}. Disponível: ${estoqueAnterior}. Necessário: ${quantidadeParaBaixar}.`,
      );
    }

    const { error: updateError } = await supabase
      .from("ingredientes")
      .update({ quantidade: estoquePosterior })
      .eq("id", ingredienteId);

    if (updateError) throw updateError;

    await registrarMovimentacaoEstoque({
      empresa_id: null,
      ingrediente_id: ingredienteId,
      tipo: "saída",
      origem: "Venda",
      documento: `venda-${vendaId}`,
      quantidade: quantidadeParaBaixar,
      estoque_anterior: estoqueAnterior,
      estoque_posterior: estoquePosterior,
      observacao: "Baixa automática por venda.",
    });
  }
}

async function criarContaReceberParaVenda(venda: Pick<Venda, "id" | "numero" | "total" | "data_venda">): Promise<void> {
  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias_financeiras")
    .select("id, nome")
    .eq("tipo", "receita")
    .order("nome")
    .limit(1)
    .maybeSingle();

  if (categoriasError) throw categoriasError;

  const { error } = await supabase.from("contas_receber").insert([
    {
      empresa_id: null,
      categoria_id: categorias?.id ?? null,
      documento: venda.numero,
      origem: "Venda",
      descricao: `Recebimento de venda ${venda.numero}`,
      valor: Number(venda.total ?? 0),
      data: venda.data_venda,
      status: "aberto",
      observacao: "Conta criada automaticamente após a venda.",
    },
  ]);

  if (error) throw error;
}

async function criarContaPagarParaCompra(compra: Pick<Compra, "id" | "fornecedor_nome" | "total" | "data_compra">): Promise<void> {
  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias_financeiras")
    .select("id, nome")
    .eq("tipo", "despesa")
    .order("nome")
    .limit(1)
    .maybeSingle();

  if (categoriasError) throw categoriasError;

  const { error } = await supabase.from("contas_pagar").insert([
    {
      empresa_id: null,
      categoria_id: categorias?.id ?? null,
      documento: compra.id,
      origem: compra.fornecedor_nome ?? "Fornecedor",
      descricao: `Pagamento de compra ${compra.id}`,
      valor: Number(compra.total ?? 0),
      data: compra.data_compra,
      status: "aberto",
      observacao: "Conta criada automaticamente após a compra.",
    },
  ]);

  if (error) throw error;
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

  receitas: async (): Promise<Receita[]> => {
    const [receitasResult, produtosResult, ingredientesResult] = await Promise.all([
      supabase.from("receitas").select("*").order("created_at", { ascending: false }),
      supabase.from("produtos").select("id, nome").order("nome"),
      supabase.from("ingredientes").select("id, nome, unidade, custo_unitario").order("nome"),
    ]);

    if (receitasResult.error) throw receitasResult.error;
    if (produtosResult.error) throw produtosResult.error;
    if (ingredientesResult.error) throw ingredientesResult.error;

    const produtosById = new Map<string, string>(
      (produtosResult.data ?? []).map((item) => [item.id as string, (item.nome as string) ?? "Produto"]),
    );

    const ingredientesById = new Map<string, Record<string, unknown>>(
      (ingredientesResult.data ?? []).map((item) => [item.id as string, item]),
    );

    const groupedByProduto = new Map<string, Receita>();

    for (const item of receitasResult.data ?? []) {
      if (item.ativo === false) {
        continue;
      }

      const produtoId = item.produto_id as string;
      const existing = groupedByProduto.get(produtoId);
      const ingrediente = ingredientesById.get(item.ingrediente_id as string);

      const receitaIngrediente = {
        id: item.id as string,
        ingrediente_id: item.ingrediente_id as string,
        nome: (ingrediente?.["nome"] as string) ?? "Ingrediente",
        unidade: (ingrediente?.["unidade"] as string) ?? "un",
        quantidade: Number(item.quantidade ?? 0),
        custo_unitario: Number(ingrediente?.["custo_unitario"] ?? 0),
      };

      if (existing) {
        existing.ingredientes.push(receitaIngrediente);
        continue;
      }

      groupedByProduto.set(produtoId, {
        id: produtoId,
        empresa_id: item.empresa_id ?? null,
        produto_id: produtoId,
        produto_nome: produtosById.get(produtoId) ?? "Produto",
        rendimento: Number(item.rendimento ?? 0),
        custo_total: Number(item.custo_total ?? 0),
        custo_por_unidade: Number(item.custo_por_unidade ?? 0),
        ingredientes: [receitaIngrediente],
        ativo: item.ativo !== false,
        created_at: item.created_at,
      });
    }

    return [...groupedByProduto.values()]
      .map((receita) => {
        const custoTotal = receita.custo_total > 0
          ? receita.custo_total
          : receita.ingredientes.reduce((total, ingrediente) => {
              return total + ingrediente.custo_unitario * ingrediente.quantidade;
            }, 0);

        const custoPorUnidade = receita.custo_por_unidade > 0
          ? receita.custo_por_unidade
          : receita.rendimento > 0
            ? custoTotal / receita.rendimento
            : custoTotal;

        return {
          ...receita,
          custo_total: custoTotal,
          custo_por_unidade: custoPorUnidade,
        };
      })
      .sort((left, right) => left.produto_nome.localeCompare(right.produto_nome));
  },

  async createReceita(input: {
    empresa_id: string | null;
    produto_id: string;
    rendimento: number;
    itens: Array<{
      ingrediente_id: string;
      quantidade: number;
    }>;
  }): Promise<Receita> {
    const ingredientIds = [...new Set(input.itens.map((item) => item.ingrediente_id))];
    const [ingredientesResult, produtoResult] = await Promise.all([
      supabase.from("ingredientes").select("id, nome, unidade, custo_unitario").in("id", ingredientIds),
      supabase.from("produtos").select("id, nome").eq("id", input.produto_id).maybeSingle(),
    ]);

    if (ingredientesResult.error) throw ingredientesResult.error;
    if (produtoResult.error) throw produtoResult.error;

    const custoPorIngrediente = new Map(
      (ingredientesResult.data ?? []).map((item) => [item.id, Number(item.custo_unitario ?? 0)]),
    );

    const totalCusto = input.itens.reduce((total, item) => {
      const custoUnitario = custoPorIngrediente.get(item.ingrediente_id) ?? 0;
      return total + custoUnitario * Number(item.quantidade ?? 0);
    }, 0);

    const custoPorUnidade = Number(input.rendimento ?? 0) > 0 ? totalCusto / Number(input.rendimento) : totalCusto;

    const rows = input.itens.map((item) => ({
      empresa_id: input.empresa_id,
      produto_id: input.produto_id,
      ingrediente_id: item.ingrediente_id,
      quantidade: item.quantidade,
      rendimento: Number(input.rendimento ?? 0),
      custo_total: totalCusto,
      custo_por_unidade: custoPorUnidade,
    }));

    const { error } = await supabase.from("receitas").insert(rows);

    if (error) throw error;

    const { error: updateError } = await supabase
      .from("produtos")
      .update({ preco_custo: custoPorUnidade })
      .eq("id", input.produto_id);

    if (updateError) throw updateError;

    const ingredientes = (ingredientesResult.data ?? []).map((item) => ({
      id: item.id as string,
      ingrediente_id: item.id as string,
      nome: item.nome as string,
      unidade: item.unidade as string,
      quantidade: Number(
        input.itens.find((recipeItem) => recipeItem.ingrediente_id === (item.id as string))?.quantidade ?? 0,
      ),
      custo_unitario: Number((item as Record<string, unknown>)["custo_unitario"] ?? 0),
    }));

    return {
      id: input.produto_id,
      empresa_id: input.empresa_id,
      produto_id: input.produto_id,
      produto_nome: produtoResult.data?.nome ?? "Produto",
      rendimento: Number(input.rendimento ?? 0),
      custo_total: totalCusto,
      custo_por_unidade: custoPorUnidade,
      ingredientes,
      ativo: true,
      created_at: new Date().toISOString(),
    };
  },

  async updateReceita(id: string, input: {
    empresa_id: string | null;
    produto_id: string;
    rendimento: number;
    itens: Array<{
      ingrediente_id: string;
      quantidade: number;
    }>;
  }): Promise<Receita> {
    const { error: deleteError } = await supabase.from("receitas").delete().eq("produto_id", id);

    if (deleteError) throw deleteError;

    return this.createReceita({
      empresa_id: input.empresa_id,
      produto_id: input.produto_id,
      rendimento: input.rendimento,
      itens: input.itens,
    });
  },

  async deleteReceita(id: string): Promise<void> {
    const { error } = await supabase.from("receitas").update({ ativo: false }).eq("produto_id", id);

    if (error) {
      const { error: fallbackError } = await supabase.from("receitas").delete().eq("produto_id", id);

      if (fallbackError) throw fallbackError;
    }
  },

  estoque: async (): Promise<ItemEstoque[]> => {
    const { data, error } = await supabase
      .from("ingredientes")
      .select("id, nome, unidade, quantidade, estoque_minimo, created_at")
      .eq("ativo", true)
      .order("nome");

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      insumo: item.nome,
      unidade: item.unidade,
      quantidade: Number(item.quantidade ?? 0),
      minimo: Number(item.estoque_minimo ?? 0),
      atualizado_em: item.created_at,
    }));
  },

  ingredientes: async (): Promise<Ingrediente[]> => {
    const { data, error } = await supabase.from("ingredientes").select("*").eq("ativo", true).order("nome");

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      empresa_id: item.empresa_id ?? null,
      nome: item.nome,
      categoria: item.categoria ?? null,
      unidade: item.unidade,
      quantidade: Number(item.quantidade ?? 0),
      estoque_minimo: Number(item.estoque_minimo ?? 0),
      custo_unitario: Number(item.custo_unitario ?? 0),
      fornecedor: item.fornecedor ?? null,
      ativo: item.ativo,
      created_at: item.created_at,
    }));
  },

  movimentacoesEstoque: async (): Promise<MovimentacaoEstoque[]> => {
    const { data, error } = await supabase
      .from("movimentacoes_estoque")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      empresa_id: item.empresa_id ?? null,
      ingrediente_id: item.ingrediente_id,
      tipo: item.tipo,
      origem: item.origem,
      documento: item.documento ?? null,
      quantidade: Number(item.quantidade ?? 0),
      estoque_anterior: Number(item.estoque_anterior ?? 0),
      estoque_posterior: Number(item.estoque_posterior ?? 0),
      observacao: item.observacao ?? null,
      created_at: item.created_at,
    }));
  },

  async createIngrediente(input: {
    empresa_id: string | null;
    nome: string;
    categoria: string | null;
    unidade: string;
    quantidade: number;
    estoque_minimo: number;
    custo_unitario: number;
    fornecedor: string | null;
    ativo: boolean;
  }): Promise<Ingrediente> {
    const { data, error } = await supabase
      .from("ingredientes")
      .insert([
        {
          empresa_id: input.empresa_id,
          nome: input.nome,
          categoria: input.categoria,
          unidade: input.unidade,
          quantidade: input.quantidade,
          estoque_minimo: input.estoque_minimo,
          custo_unitario: input.custo_unitario,
          fornecedor: input.fornecedor,
          ativo: input.ativo,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    await registrarMovimentacaoEstoque({
      empresa_id: input.empresa_id,
      ingrediente_id: data.id,
      tipo: "entrada",
      origem: "Compra",
      documento: `compra-${data.id}`,
      quantidade: Number(input.quantidade ?? 0),
      estoque_anterior: 0,
      estoque_posterior: Number(input.quantidade ?? 0),
      observacao: "Entrada inicial de estoque cadastrada.",
    });

    return {
      id: data.id,
      empresa_id: data.empresa_id ?? null,
      nome: data.nome,
      categoria: data.categoria ?? null,
      unidade: data.unidade,
      quantidade: Number(data.quantidade ?? 0),
      estoque_minimo: Number(data.estoque_minimo ?? 0),
      custo_unitario: Number(data.custo_unitario ?? 0),
      fornecedor: data.fornecedor ?? null,
      ativo: data.ativo,
      created_at: data.created_at,
    };
  },

  async updateIngrediente(id: string, input: {
    nome: string;
    categoria: string | null;
    unidade: string;
    quantidade: number;
    estoque_minimo: number;
    custo_unitario: number;
    fornecedor: string | null;
    ativo: boolean;
  }): Promise<Ingrediente> {
    const { data: ingredienteAtual, error: fetchError } = await supabase
      .from("ingredientes")
      .select("quantidade, nome")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const estoqueAnterior = Number(ingredienteAtual?.quantidade ?? 0);
    const estoquePosterior = Number(input.quantidade ?? 0);
    const diferencaQuantidade = estoquePosterior - estoqueAnterior;

    const { data, error } = await supabase
      .from("ingredientes")
      .update({
        nome: input.nome,
        categoria: input.categoria,
        unidade: input.unidade,
        quantidade: input.quantidade,
        estoque_minimo: input.estoque_minimo,
        custo_unitario: input.custo_unitario,
        fornecedor: input.fornecedor,
        ativo: input.ativo,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (diferencaQuantidade !== 0) {
      await registrarMovimentacaoEstoque({
        empresa_id: data.empresa_id ?? null,
        ingrediente_id: id,
        tipo: "ajuste",
        origem: "Ajuste",
        documento: `ajuste-${id}`,
        quantidade: Math.abs(diferencaQuantidade),
        estoque_anterior: estoqueAnterior,
        estoque_posterior: estoquePosterior,
        observacao: diferencaQuantidade > 0 ? "Ajuste positivo de estoque." : "Ajuste negativo de estoque.",
      });
    }

    return {
      id: data.id,
      empresa_id: data.empresa_id ?? null,
      nome: data.nome,
      categoria: data.categoria ?? null,
      unidade: data.unidade,
      quantidade: Number(data.quantidade ?? 0),
      estoque_minimo: Number(data.estoque_minimo ?? 0),
      custo_unitario: Number(data.custo_unitario ?? 0),
      fornecedor: data.fornecedor ?? null,
      ativo: data.ativo,
      created_at: data.created_at,
    };
  },

  async deleteIngrediente(id: string): Promise<void> {
    const { error } = await supabase.from("ingredientes").update({ ativo: false }).eq("id", id);

    if (error) throw error;
  },

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

  async createFornecedor(input: {
    nome: string;
    contato: string | null;
    categoria: string | null;
  }): Promise<Fornecedor> {
    const { data, error } = await supabase
      .from("fornecedores")
      .insert([
        {
          nome: input.nome,
          contato: input.contato,
          categoria: input.categoria,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      nome: data.nome,
      contato: data.contato ?? null,
      categoria: data.categoria ?? null,
      created_at: data.created_at,
    };
  },

  async updateFornecedor(id: string, input: {
    nome: string;
    contato: string | null;
    categoria: string | null;
  }): Promise<Fornecedor> {
    const { data, error } = await supabase
      .from("fornecedores")
      .update({
        nome: input.nome,
        contato: input.contato,
        categoria: input.categoria,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      nome: data.nome,
      contato: data.contato ?? null,
      categoria: data.categoria ?? null,
      created_at: data.created_at,
    };
  },

  async deleteFornecedor(id: string): Promise<void> {
    const { error } = await supabase.from("fornecedores").delete().eq("id", id);

    if (error) throw error;
  },

  fornecedores: async (): Promise<Fornecedor[]> => {
    const { data, error } = await supabase.from("fornecedores").select("*").order("nome");

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      contato: item.contato ?? null,
      categoria: item.categoria ?? null,
      created_at: item.created_at,
    }));
  },

  compras: async (): Promise<Compra[]> => {
    const { data, error } = await supabase
      .from("compras")
      .select("*, itens_compra(*)")
      .order("data_compra", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      empresa_id: item.empresa_id ?? null,
      fornecedor_id: item.fornecedor_id,
      fornecedor_nome: item.fornecedor_nome,
      data_compra: item.data_compra,
      observacao: item.observacao ?? null,
      total: Number(item.total ?? 0),
      created_at: item.created_at,
      itens: (item.itens_compra ?? []).map((linha: Record<string, unknown>) => ({
        id: linha["id"] as string,
        compra_id: linha["compra_id"] as string,
        ingrediente_id: linha["ingrediente_id"] as string,
        ingrediente_nome: (linha["ingrediente_nome"] as string | null) ?? null,
        quantidade: Number(linha["quantidade"] ?? 0),
        unidade: (linha["unidade"] as string) ?? "un",
        valor_unitario: Number(linha["valor_unitario"] ?? 0),
        valor_total: Number(linha["valor_total"] ?? 0),
        created_at: linha["created_at"] as string,
      })),
    }));
  },

  async createCompra(input: {
    empresa_id: string | null;
    fornecedor_id: string | null;
    fornecedor_nome: string | null;
    data_compra: string;
    observacao: string | null;
    total: number;
    itens: Array<{
      ingrediente_id: string;
      ingrediente_nome: string | null;
      quantidade: number;
      unidade: string;
      valor_unitario: number;
      valor_total: number;
    }>;
  }): Promise<Compra> {
    const { data: compraData, error: compraError } = await supabase
      .from("compras")
      .insert([
        {
          empresa_id: input.empresa_id,
          fornecedor_id: input.fornecedor_id,
          fornecedor_nome: input.fornecedor_nome,
          data_compra: input.data_compra,
          observacao: input.observacao,
          total: input.total,
        },
      ])
      .select()
      .single();

    if (compraError) throw compraError;

    const compraId = compraData?.id as string | undefined;

    if (!compraId) {
      throw new Error("Não foi possível localizar a compra criada.");
    }

    const itensPayload = input.itens.map((item) => ({
      compra_id: compraId,
      ingrediente_id: item.ingrediente_id,
      ingrediente_nome: item.ingrediente_nome,
      quantidade: item.quantidade,
      unidade: item.unidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
    }));

    const { error: itensError } = await supabase.from("itens_compra").insert(itensPayload);

    if (itensError) throw itensError;

    for (const item of input.itens) {
      const { data: ingredienteAtual, error: ingredienteFetchError } = await supabase
        .from("ingredientes")
        .select("quantidade, custo_unitario, nome")
        .eq("id", item.ingrediente_id)
        .maybeSingle();

      if (ingredienteFetchError) throw ingredienteFetchError;

      const estoqueAnterior = Number(ingredienteAtual?.quantidade ?? 0);
      const estoquePosterior = estoqueAnterior + Number(item.quantidade ?? 0);
      const custoAnterior = Number(ingredienteAtual?.custo_unitario ?? 0);
      const novoCusto = Number(item.valor_unitario ?? 0);
      const custoMedio =
        estoqueAnterior > 0
          ? (custoAnterior * estoqueAnterior + novoCusto * Number(item.quantidade ?? 0)) / estoquePosterior
          : novoCusto;

      const { error: estoqueUpdateError } = await supabase
        .from("ingredientes")
        .update({
          quantidade: estoquePosterior,
          custo_unitario: custoMedio,
        })
        .eq("id", item.ingrediente_id);

      if (estoqueUpdateError) throw estoqueUpdateError;

      await recalcularReceitasPorIngrediente(item.ingrediente_id);

      await registrarMovimentacaoEstoque({
        empresa_id: input.empresa_id,
        ingrediente_id: item.ingrediente_id,
        tipo: "entrada",
        origem: "Compra",
        documento: `compra-${compraId}`,
        quantidade: Number(item.quantidade ?? 0),
        estoque_anterior: estoqueAnterior,
        estoque_posterior: estoquePosterior,
        observacao: `Compra registrada para ${ingredienteAtual?.nome ?? "ingrediente"}.`,
      });
    }

    return {
      id: compraData.id,
      empresa_id: compraData.empresa_id ?? null,
      fornecedor_id: compraData.fornecedor_id,
      fornecedor_nome: compraData.fornecedor_nome,
      data_compra: compraData.data_compra,
      observacao: compraData.observacao ?? null,
      total: Number(compraData.total ?? 0),
      created_at: compraData.created_at,
      itens: itensPayload.map((item) => ({
        id: `${compraId}-${item.ingrediente_id}`,
        compra_id: compraId,
        ingrediente_id: item.ingrediente_id,
        ingrediente_nome: item.ingrediente_nome,
        quantidade: Number(item.quantidade ?? 0),
        unidade: item.unidade,
        valor_unitario: Number(item.valor_unitario ?? 0),
        valor_total: Number(item.valor_total ?? 0),
        created_at: compraData.created_at,
      })),
    };
  },

  async updateCompra(id: string, input: {
    empresa_id: string | null;
    fornecedor_id: string | null;
    fornecedor_nome: string | null;
    data_compra: string;
    observacao: string | null;
    total: number;
    itens: Array<{
      ingrediente_id: string;
      ingrediente_nome: string | null;
      quantidade: number;
      unidade: string;
      valor_unitario: number;
      valor_total: number;
    }>;
  }): Promise<Compra> {
    const { error: deleteItemsError } = await supabase.from("itens_compra").delete().eq("compra_id", id);

    if (deleteItemsError) throw deleteItemsError;

    const { error: deleteCompraError } = await supabase.from("compras").delete().eq("id", id);

    if (deleteCompraError) throw deleteCompraError;

    return this.createCompra({
      empresa_id: input.empresa_id,
      fornecedor_id: input.fornecedor_id,
      fornecedor_nome: input.fornecedor_nome,
      data_compra: input.data_compra,
      observacao: input.observacao,
      total: input.total,
      itens: input.itens,
    });
  },

  async deleteCompra(id: string): Promise<void> {
    const { error } = await supabase.from("compras").delete().eq("id", id);

    if (error) throw error;
  },

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
    const reducoesPorIngrediente = await calcularBaixaEstoqueVenda(
      input.itens.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
      })),
    );

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
    await aplicarBaixaEstoqueVenda(vendaId, reducoesPorIngrediente);
    await criarContaReceberParaVenda({
      id: vendaId,
      numero: input.numero,
      total: input.total,
      data_venda: input.data_venda,
    });

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

  categoriasFinanceiras: async (): Promise<CategoriaFinanceira[]> => {
    const { data, error } = await supabase.from("categorias_financeiras").select("*").order("nome");

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      tipo: item.tipo,
      cor: item.cor ?? null,
      ativo: item.ativo,
      created_at: item.created_at,
    }));
  },

  contasReceber: async (): Promise<ContaReceber[]> => {
    const { data, error } = await supabase.from("contas_receber").select("*").order("data", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      empresa_id: item.empresa_id ?? null,
      categoria_id: item.categoria_id ?? null,
      categoria: item.categoria ?? null,
      documento: item.documento ?? null,
      origem: item.origem ?? "—",
      descricao: item.descricao ?? "",
      valor: Number(item.valor ?? 0),
      data: item.data,
      status: item.status,
      observacao: item.observacao ?? null,
      created_at: item.created_at,
    }));
  },

  contasPagar: async (): Promise<ContaPagar[]> => {
    const { data, error } = await supabase.from("contas_pagar").select("*").order("data", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      empresa_id: item.empresa_id ?? null,
      categoria_id: item.categoria_id ?? null,
      categoria: item.categoria ?? null,
      documento: item.documento ?? null,
      origem: item.origem ?? "—",
      descricao: item.descricao ?? "",
      valor: Number(item.valor ?? 0),
      data: item.data,
      status: item.status,
      observacao: item.observacao ?? null,
      created_at: item.created_at,
    }));
  },

  lancamentos: () => empty<Lancamento>(),
  metas: () => empty<Meta>(),

  async dashboardFinanceiro(): Promise<DashboardFinanceiro> {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1).toISOString();

    const [{ data: contasReceberMes }, { data: contasPagarMes }] = await Promise.all([
      supabase.from("contas_receber").select("valor").gte("data", inicioMes).lt("data", fimMes),
      supabase.from("contas_pagar").select("valor").gte("data", inicioMes).lt("data", fimMes),
    ]);

    const receitasDoMes = (contasReceberMes ?? []).reduce((total, item) => total + Number(item.valor ?? 0), 0);
    const despesasDoMes = (contasPagarMes ?? []).reduce((total, item) => total + Number(item.valor ?? 0), 0);

    return {
      receitas_do_mes: receitasDoMes,
      despesas_do_mes: despesasDoMes,
      saldo: receitasDoMes - despesasDoMes,
      lucro_liquido: receitasDoMes - despesasDoMes,
    };
  },

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
