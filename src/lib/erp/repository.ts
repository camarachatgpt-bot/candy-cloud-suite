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
  Ingrediente,
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
        nome: (ingrediente?.nome as string) ?? "Ingrediente",
        unidade: (ingrediente?.unidade as string) ?? "un",
        quantidade: Number(item.quantidade ?? 0),
        custo_unitario: Number(ingrediente?.custo_unitario ?? 0),
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
      id: item.id,
      ingrediente_id: item.id,
      nome: item.nome,
      unidade: item.unidade,
      quantidade: Number(
        input.itens.find((recipeItem) => recipeItem.ingrediente_id === item.id)?.quantidade ?? 0,
      ),
      custo_unitario: Number(item.custo_unitario ?? 0),
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
