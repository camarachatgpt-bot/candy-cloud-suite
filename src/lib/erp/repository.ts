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
  CustoFixo,
  DashboardAlerta,
  DashboardCustosFixos,
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
  Notificacao,
  ParametrosFinanceiros,
  Produto,
  Receita,
  ResumoDashboard,
  Venda,
} from "./types";

import { supabase } from "../supabase";
import { calcularLucroOperacionalHoje } from "./dashboard-metrics";
import { normalizarStatusParaDb } from "./status";
import {
  calcularCustoTotal,
  calcularMargem,
  calcularPrecoReferencia,
  calcularRateioCustosFixos,
} from "./rateio";

async function empty<T>(): Promise<T[]> {
  return [];
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

async function removerMovimentacoesAjustePorIngrediente(ingredienteId: string): Promise<void> {
  const { error } = await supabase
    .from("movimentacoes_estoque")
    .delete()
    .eq("ingrediente_id", ingredienteId)
    .eq("origem", "Ajuste");

  if (error) throw error;
}

async function listarItensEstoqueCritico(): Promise<Array<{ id: string; nome: string; quantidade: number; estoque_minimo: number }>> {
  const { data, error } = await supabase
    .from("ingredientes")
    .select("id, nome, quantidade, estoque_minimo")
    .eq("ativo", true);

  if (error) throw error;

  return (data ?? []).filter((item) => Number(item.quantidade ?? 0) <= Number(item.estoque_minimo ?? 0));
}

function calcularDiasRestantes(dataVencimento: string | null): number {
  if (!dataVencimento) return 0;

  const hoje = new Date();
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const vencimento = new Date(dataVencimento);
  const vencimentoSemHora = new Date(vencimento.getFullYear(), vencimento.getMonth(), vencimento.getDate());

  return Math.round((vencimentoSemHora.getTime() - hojeSemHora.getTime()) / 86_400_000);
}

function formatarMensagemAlerta(diasRestantes: number, descricao: string): string {
  if (diasRestantes < 0) return `Venceu há ${Math.abs(diasRestantes)} dia(s)`;
  if (diasRestantes === 0) return "Vence hoje";
  if (diasRestantes === 1) return "Vence amanhã";
  return `Vence em ${diasRestantes} dia(s)`;
}

function calcularMargemAtual(precoVenda: number, custoTotal: number): number {
  if (precoVenda <= 0) {
    return 0;
  }

  return ((precoVenda - custoTotal) / precoVenda) * 100;
}

function calcularPrecoRecomendado(precoMinimo: number, precoIdealSugerido: number): number {
  if (precoIdealSugerido > 0) {
    return precoIdealSugerido;
  }

  return precoMinimo;
}

function calcularLucroBruto(receita: number, custosVariaveis: number): number {
  return receita - custosVariaveis;
}

function calcularLucroLiquido(receita: number, custosVariaveis: number, custosFixos: number, taxas: number): number {
  return receita - custosVariaveis - custosFixos - taxas;
}

function calcularCaixaDisponivel(saldoInicial: number, recebimentos: number, pagamentos: number): number {
  return saldoInicial + recebimentos - pagamentos;
}

function calcularCustosVariaveisPorItens(
  itensVenda: Array<Record<string, unknown>>,
  custosPorProduto: Map<string, number>,
): number {
  return itensVenda.reduce((total, item) => {
    const produtoId = item["produto_id"] as string | null;
    const custoUnitario = produtoId ? custosPorProduto.get(produtoId) ?? 0 : 0;
    return total + custoUnitario * Number(item["quantidade"] ?? 0);
  }, 0);
}

function calcularPrecoBaseComMargem(
  custoVariavel: number,
  custosFixosRateados: number,
  taxasPercentuais: number,
  margemDesejada: number,
): number {
  const custoTotal = calcularCustoTotal(custoVariavel, custosFixosRateados);
  const custoComTaxas = custoTotal * (1 + taxasPercentuais / 100);
  const margemDesejadaPercentual = Math.max(0, margemDesejada);

  return custoComTaxas / (1 - margemDesejadaPercentual / 100);
}

function calcularIntervaloEntreVencimentos(contas: Array<Record<string, unknown>>): number {
  const vencimentos = (contas ?? [])
    .map((conta) => conta["data_vencimento"] as string | null)
    .filter((data): data is string => Boolean(data))
    .sort()
    .map((data) => new Date(data));

  if (vencimentos.length >= 2) {
    const primeiroVencimento = vencimentos[0];
    const segundoVencimento = vencimentos[1];

    if (primeiroVencimento && segundoVencimento) {
      return Math.round((segundoVencimento.getTime() - primeiroVencimento.getTime()) / 86_400_000);
    }
  }

  return 30;
}

async function removerNotificacoesPorOrigem(origemPrefix: string): Promise<void> {
  const { error } = await supabase.from("notificacoes").delete().like("origem", `${origemPrefix}%`);

  if (error) throw error;
}

async function removerMovimentacoesPorReferencia(origem: "Compra" | "Venda", documento: string): Promise<void> {
  const { error } = await supabase.from("movimentacoes_estoque").delete().eq("origem", origem).eq("documento", documento);

  if (error) throw error;
}

async function limparMovimentacoesOrfaas(): Promise<void> {
  const [{ data: compras, error: comprasError }, { data: vendas, error: vendasError }, { data: ingredientes, error: ingredientesError }] = await Promise.all([
    supabase.from("compras").select("id"),
    supabase.from("vendas").select("id"),
    supabase.from("ingredientes").select("id"),
  ]);

  if (comprasError) throw comprasError;
  if (vendasError) throw vendasError;
  if (ingredientesError) throw ingredientesError;

  const compraIds = new Set((compras ?? []).map((item) => String(item.id)));
  const vendaIds = new Set((vendas ?? []).map((item) => String(item.id)));
  const ingredienteIds = new Set((ingredientes ?? []).map((item) => String(item.id)));

  const { data: movimentacoes, error: movimentacoesError } = await supabase
    .from("movimentacoes_estoque")
    .select("id, origem, documento, ingrediente_id");

  if (movimentacoesError) throw movimentacoesError;

  const idsParaRemover = (movimentacoes ?? []).flatMap((movimentacao) => {
    const origem = String(movimentacao.origem ?? "");
    const documento = String(movimentacao.documento ?? "");
    const ingredienteId = String(movimentacao.ingrediente_id ?? "");

    if (origem === "Compra") {
      if (!documento.startsWith("compra-")) {
        return [movimentacao.id as string];
      }

      const compraId = documento.replace(/^compra-/, "");
      return compraIds.has(compraId) ? [] : [movimentacao.id as string];
    }

    if (origem === "Venda") {
      if (!documento.startsWith("venda-")) {
        return [movimentacao.id as string];
      }

      const vendaId = documento.replace(/^venda-/, "");
      return vendaIds.has(vendaId) ? [] : [movimentacao.id as string];
    }

    if (!ingredienteId) {
      return [movimentacao.id as string];
    }

    return ingredienteIds.has(ingredienteId) ? [] : [movimentacao.id as string];
  });

  if (idsParaRemover.length > 0) {
    const { error: deleteError } = await supabase.from("movimentacoes_estoque").delete().in("id", idsParaRemover);

    if (deleteError) throw deleteError;
  }
}

async function sincronizarNotificacoesFinanceiras(): Promise<void> {
  const hoje = new Date();
  const notificacoesParaInserir: Array<Record<string, unknown>> = [];

  await removerNotificacoesPorOrigem("conta-pagar");
  await removerNotificacoesPorOrigem("custo-fixo");

  const [{ data: contasPagar, error: errorContasPagar }, { data: custosFixos, error: errorCustosFixos }] = await Promise.all([
    supabase
      .from("contas_pagar")
      .select("*")
      .order("data_vencimento", { ascending: true }),
    supabase
      .from("custos_fixos")
      .select("id, nome, valor_mensal, data_vencimento, status")
      .eq("status", "Ativo"),
  ]);

  if (errorContasPagar) throw errorContasPagar;
  if (errorCustosFixos) throw errorCustosFixos;

  const contasPagarAtivas = (contasPagar ?? []).filter((conta) => {
    const status = normalizarStatusFinanceiro((conta as Record<string, unknown>)["status"] as string | null | undefined);
    return status !== "Pago";
  });

  for (const conta of contasPagarAtivas) {
    const dataVencimento = (conta as Record<string, unknown>)["data_vencimento"] as string | null;
    const valor = Number((conta as Record<string, unknown>)["valor_total"] ?? (conta as Record<string, unknown>)["valor"] ?? 0);
    const status = (conta as Record<string, unknown>)["status"] as string | null;
    const descricao = ((conta as Record<string, unknown>)["descricao"] as string | null) ?? "Conta a pagar";

    if (status === "Pago" || !dataVencimento) continue;

    const diasRestantes = calcularDiasRestantes(dataVencimento);

    if (diasRestantes > 7 || diasRestantes < -1) continue;

    const prioridade = diasRestantes < 0 ? "alta" : diasRestantes === 0 ? "alta" : "media";
    const titulo = diasRestantes < 0 ? "Conta vencida" : diasRestantes === 0 ? "Conta vence hoje" : "Conta vencendo em breve";
    const mensagem = formatarMensagemAlerta(diasRestantes, descricao);
    const contaId = (conta as Record<string, unknown>)["id"] as string | undefined;

    notificacoesParaInserir.push({
      tipo: diasRestantes < 0 ? "conta_vencida" : diasRestantes === 0 ? "conta_vencendo_hoje" : "conta_vencendo_7_dias",
      titulo,
      descricao: `${descricao} • ${mensagem}`,
      prioridade,
      lida: false,
      data: hoje.toISOString().slice(0, 10),
      origem: `conta-pagar:${contaId ?? "conta"}`,
      valor,
      data_vencimento: dataVencimento,
      dias_restantes: diasRestantes,
      link: `/financeiro?focus=conta-pagar:${contaId ?? "conta"}`,
      referencia_id: contaId ?? "",
      referencia_tipo: "conta-pagar",
    });
  }

  for (const custo of custosFixos ?? []) {
    const custoId = (custo as Record<string, unknown>)["id"] as string | undefined;
    const dataVencimento = (custo as Record<string, unknown>)["data_vencimento"] as string | null;
    const valor = Number((custo as Record<string, unknown>)["valor_mensal"] ?? 0);

    if (!dataVencimento || valor <= 0 || !custoId) continue;

    const contaVinculada = (contasPagar ?? []).find((conta) => {
      const documento = (conta as Record<string, unknown>)["documento"] as string | null;
      return documento === `custo-fixo:${custoId}`;
    });
    const statusContaVinculada = contaVinculada
      ? normalizarStatusFinanceiro((contaVinculada as Record<string, unknown>)["status"] as string | null | undefined)
      : null;

    if (statusContaVinculada === "Pago" || statusContaVinculada === "Parcial") continue;

    const diasRestantes = calcularDiasRestantes(dataVencimento);

    if (diasRestantes > 7 || diasRestantes < -1) continue;

    const prioridade = diasRestantes < 0 ? "alta" : diasRestantes === 0 ? "alta" : "media";
    const titulo = diasRestantes < 0 ? "Custo fixo vencido" : diasRestantes === 0 ? "Custo fixo vence hoje" : "Custo fixo vencendo em breve";
    const mensagem = formatarMensagemAlerta(diasRestantes, (custo as Record<string, unknown>)["nome"] as string);

    notificacoesParaInserir.push({
      tipo: diasRestantes < 0 ? "custo_fixo_vencido" : diasRestantes === 0 ? "custo_fixo_vencendo_hoje" : "custo_fixo_vencendo_7_dias",
      titulo,
      descricao: `${(custo as Record<string, unknown>)["nome"] as string} • ${mensagem}`,
      prioridade,
      lida: false,
      data: hoje.toISOString().slice(0, 10),
      origem: `custo-fixo:${(custo as Record<string, unknown>)["id"]}`,
      valor,
      data_vencimento: dataVencimento,
      dias_restantes: diasRestantes,
      link: "/custos-fixos",
      referencia_id: (custo as Record<string, unknown>)["id"] as string,
      referencia_tipo: "custo-fixo",
    });
  }

  if (notificacoesParaInserir.length > 0) {
    const { error } = await supabase.from("notificacoes").insert(notificacoesParaInserir);

    if (error) throw error;
  }
}

async function calcularMetricasProduto(produtoId: string): Promise<void> {
  const [receitasResult, custosFixosResult, parametrosResult] = await Promise.all([
    supabase.from("receitas").select("*", { count: "exact" }).eq("produto_id", produtoId),
    supabase.from("custos_fixos").select("valor_mensal").eq("status", "Ativo"),
    supabase.from("parametros_financeiros").select("*", { count: "exact" }).maybeSingle(),
  ]);

  if (receitasResult.error) throw receitasResult.error;
  if (custosFixosResult.error) throw custosFixosResult.error;
  if (parametrosResult.error) throw parametrosResult.error;

  const receitas = receitasResult.data ?? [];
  const custoReceita = receitas.reduce((total, receita) => {
    return total + Number(receita.custo_por_unidade ?? 0) * Number(receita.rendimento ?? 0);
  }, 0);

  const valorCustosFixos = (custosFixosResult.data ?? []).reduce((total, item) => {
    return total + Number(item.valor_mensal ?? 0);
  }, 0);

  const parametros = parametrosResult.data as Record<string, unknown> | null;
  const taxaIfood = Number(parametros?.["taxa_ifood"] ?? 0);
  const taxa99food = Number(parametros?.["taxa_99food"] ?? 0);
  const taxaCartao = Number(parametros?.["taxa_cartao"] ?? 0);
  const comissao = Number(parametros?.["comissao"] ?? 0);
  const margemLucroDesejada = Number(parametros?.["margem_lucro_desejada"] ?? 0);
  const percentualPerdas = Number(parametros?.["percentual_perdas"] ?? 0);
  const metaMensalVendasUnidades = Number(parametros?.["meta_mensal_vendas_unidades"] ?? 0);

  const custoPorUnidade = receitas.length > 0 ? custoReceita / Math.max(1, Number(receitas[0]?.rendimento ?? 0)) : 0;
  const rateioCustosFixos = calcularRateioCustosFixos(valorCustosFixos, metaMensalVendasUnidades);
  const custoTotal = calcularCustoTotal(custoPorUnidade, rateioCustosFixos);
  const margem = Math.max(0, margemLucroDesejada);
  const taxasPercentuais = taxaIfood + taxa99food + taxaCartao + comissao + percentualPerdas;
  const precoMinimo = calcularPrecoBaseComMargem(custoPorUnidade, rateioCustosFixos, taxasPercentuais, margem);
  const precoIdealSugerido = calcularPrecoBaseComMargem(custoPorUnidade, rateioCustosFixos, taxasPercentuais, margem);

  const { error: updateError } = await supabase
    .from("produtos")
    .update({
      preco_custo: custoPorUnidade,
      custo_receita: custoPorUnidade,
      rateio_custos_fixos: rateioCustosFixos,
      custo_total: custoTotal,
      margem: margem,
      preco_minimo: precoMinimo,
      preco_ideal_sugerido: precoIdealSugerido,
    })
    .eq("id", produtoId);

  if (updateError) throw updateError;
}

async function recalculateProductsFromCostDrivers(): Promise<void> {
  const { data: produtos, error } = await supabase.from("produtos").select("id").eq("ativo", true);

  if (error) throw error;

  await Promise.all((produtos ?? []).map((item) => calcularMetricasProduto(item.id as string)));
}

async function persistItensVenda(itens: Array<Record<string, unknown>>): Promise<void> {
  if (itens.length === 0) {
    return;
  }

  const { error } = await supabase.from("itens_venda").insert(itens);

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

      await calcularMetricasProduto(produtoId);
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

async function calcularEstornoEstoqueVenda(
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

  const adicoesPorIngrediente = new Map<string, number>();

  for (const receitas of receitasPorProduto) {
    for (const receita of receitas) {
      if (!receita.ingrediente_id || receita.rendimento <= 0 || receita.quantidade <= 0) {
        continue;
      }

      const quantidadeParaAdicionar = (receita.quantidade / receita.rendimento) * receita.quantidadeVendida;
      const quantidadeAtual = adicoesPorIngrediente.get(receita.ingrediente_id) ?? 0;
      adicoesPorIngrediente.set(receita.ingrediente_id, quantidadeAtual + quantidadeParaAdicionar);
    }
  }

  return adicoesPorIngrediente;
}

async function aplicarEstornoEstoqueVenda(
  vendaId: string,
  adicoesPorIngrediente: Map<string, number>,
): Promise<void> {
  for (const [ingredienteId, quantidadeParaAdicionar] of adicoesPorIngrediente.entries()) {
    const { data: ingredienteAtual, error: ingredienteError } = await supabase
      .from("ingredientes")
      .select("quantidade, nome")
      .eq("id", ingredienteId)
      .maybeSingle();

    if (ingredienteError) throw ingredienteError;

    const estoqueAnterior = Number(ingredienteAtual?.quantidade ?? 0);
    const estoquePosterior = estoqueAnterior + quantidadeParaAdicionar;

    const { error: updateError } = await supabase
      .from("ingredientes")
      .update({ quantidade: estoquePosterior })
      .eq("id", ingredienteId);

    if (updateError) throw updateError;

    await recalcularReceitasPorIngrediente(ingredienteId);
  }

  await removerMovimentacoesPorReferencia("Venda", `venda-${vendaId}`);
}

function normalizarStatusFinanceiro(status: string | null | undefined): string {
  const valor = status?.trim();

  if (!valor) return "Pendente";

  const statusNormalizado = valor.toLowerCase();

  if (statusNormalizado === "pago") return "Pago";
  if (statusNormalizado === "recebido") return "Recebido";
  if (statusNormalizado === "parcial") return "Parcial";
  if (statusNormalizado === "atrasado" || statusNormalizado === "vencido") return "Vencido";
  if (statusNormalizado === "cancelado") return "Pendente";
  if (statusNormalizado === "aberto") return "Pendente";

  return "Pendente";
}

function normalizarStatusContaPagar(status: string | null | undefined): ContaPagar["status"] {
  const valor = status?.trim();

  if (!valor) return "Pendente";

  const statusNormalizado = valor.toLowerCase();

  if (statusNormalizado === "pago") return "Pago";
  if (statusNormalizado === "parcial") return "Parcial";
  if (statusNormalizado === "atrasado" || statusNormalizado === "vencido") return "Vencido";
  if (statusNormalizado === "cancelado") return "Pendente";
  return "Pendente";
}

function normalizarStatusContaReceber(status: string | null | undefined): ContaReceber["status"] {
  const valor = status?.trim();

  if (!valor) return "Pendente";

  const statusNormalizado = valor.toLowerCase();

  if (statusNormalizado === "pago" || statusNormalizado === "recebido") return "Recebido";
  if (statusNormalizado === "parcial") return "Parcial";
  if (statusNormalizado === "atrasado" || statusNormalizado === "vencido") return "Vencido";
  if (statusNormalizado === "cancelado") return "Pendente";
  return "Pendente";
}

function calcularStatusContaPagar(input: {
  valorPago: number;
  valorTotal: number;
  dataVencimento: string | null;
}): ContaPagar["status"] {
  const hoje = new Date();
  const vencido = input.dataVencimento ? new Date(input.dataVencimento) < hoje : false;

  if (input.valorPago >= input.valorTotal) return "Pago";
  if (input.valorPago > 0) return "Parcial";
  if (vencido) return "Vencido";
  return "Pendente";
}

function calcularStatusContaReceber(input: {
  valorRecebido: number;
  valorTotal: number;
  dataVencimento: string | null;
}): ContaReceber["status"] {
  const hoje = new Date();
  const vencido = input.dataVencimento ? new Date(input.dataVencimento) < hoje : false;

  if (input.valorRecebido >= input.valorTotal) return "Recebido";
  if (input.valorRecebido > 0) return "Parcial";
  if (vencido) return "Vencido";
  return "Pendente";
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

  const dataVencimento = new Date(venda.data_venda);
  dataVencimento.setDate(dataVencimento.getDate() + 7);

  const { error } = await supabase.from("contas_receber").insert([{
    empresa_id: null,
    categoria_id: categorias?.id ?? null,
    documento: venda.numero,
    origem: "Venda",
    descricao: `Recebimento de venda ${venda.numero}`,
    valor: Number(venda.total ?? 0),
    data: venda.data_venda,
    data_emissao: venda.data_venda,
    data_vencimento: dataVencimento.toISOString().slice(0, 10),
    valor_total: Number(venda.total ?? 0),
    valor_recebido: 0,
    valor_aberto: Number(venda.total ?? 0),
    forma_recebimento: null,
    numero_parcela: 1,
    total_parcelas: 1,
    status: "Pendente",
    observacao: "Conta criada automaticamente após a venda.",
  }]);

  if (error) throw error;
}

async function criarContaPagarParaCompra(
  compra: Pick<Compra, "id" | "fornecedor_nome" | "total" | "data_compra"> & {
    tipo_pagamento?: "avista" | "prazo" | null;
    forma_pagamento?: string | null;
    data_pagamento?: string | null;
    observacao_pagamento?: string | null;
    parcelamento?: { parcelas: number; intervaloDias: number; primeiroVencimento?: string | null } | null;
  },
): Promise<void> {
  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias_financeiras")
    .select("id, nome")
    .eq("tipo", "despesa")
    .order("nome")
    .limit(1)
    .maybeSingle();

  if (categoriasError) throw categoriasError;

  const tipoPagamento = compra.tipo_pagamento === "prazo" ? "prazo" : "avista";
  const valorTotal = Number(compra.total ?? 0);
  const parcelas = Math.max(1, compra.parcelamento?.parcelas ?? 1);
  const intervaloDias = Math.max(1, compra.parcelamento?.intervaloDias ?? 30);
  const primeiroVencimento = compra.parcelamento?.primeiroVencimento ?? compra.data_compra;

  if (tipoPagamento === "avista") {
    const dataPagamento = compra.data_pagamento ?? compra.data_compra;
    const dataVencimento = new Date(dataPagamento || compra.data_compra);

    const { error } = await supabase.from("contas_pagar").insert([{
      empresa_id: null,
      categoria_id: categorias?.id ?? null,
      documento: compra.id,
      origem: compra.fornecedor_nome ?? "Fornecedor",
      descricao: `Pagamento de compra ${compra.id}`,
      valor: valorTotal,
      data: compra.data_compra,
      data_emissao: compra.data_compra,
      data_vencimento: dataVencimento.toISOString().slice(0, 10),
      valor_total: valorTotal,
      valor_pago: valorTotal,
      valor_aberto: 0,
      forma_pagamento: compra.forma_pagamento ?? null,
      numero_parcela: 1,
      total_parcelas: 1,
      status: "Pago",
      data_pagamento: dataPagamento,
      observacao: compra.observacao_pagamento ?? "Conta criada automaticamente após a compra.",
    }]);

    if (error) throw error;
    return;
  }

  const valorPorParcela = valorTotal / parcelas;
  const contasParaInserir = Array.from({ length: parcelas }, (_, index) => {
    const dataBase = new Date(primeiroVencimento || compra.data_compra);
    dataBase.setDate(dataBase.getDate() + index * intervaloDias);

    return {
      empresa_id: null,
      categoria_id: categorias?.id ?? null,
      documento: `${compra.id}-${index + 1}`,
      origem: compra.fornecedor_nome ?? "Fornecedor",
      descricao: `Parcela ${index + 1}/${parcelas} de compra ${compra.id}`,
      valor: valorPorParcela,
      data: compra.data_compra,
      data_emissao: compra.data_compra,
      data_vencimento: dataBase.toISOString().slice(0, 10),
      valor_total: valorPorParcela,
      valor_pago: 0,
      valor_aberto: valorPorParcela,
      forma_pagamento: null,
      numero_parcela: index + 1,
      total_parcelas: parcelas,
      status: "Pendente",
      data_pagamento: null,
      observacao: compra.observacao_pagamento ?? "Conta criada automaticamente após a compra.",
    };
  });

  const { error } = await supabase.from("contas_pagar").insert(contasParaInserir);

  if (error) throw error;
}

export const erpRepository = {
  produtos: async (): Promise<Produto[]> => {
    const { data, error } = await supabase.from("produtos").select("*").order("nome");

    if (error) throw error;

    return (data ?? []).map((item) => {
      const precoVenda = Number(item.preco_venda ?? 0);
      const custoTotal = Number(item.custo_total ?? 0);
      const precoMinimo = Number(item.preco_minimo ?? 0);
      const precoIdealSugerido = Number(item.preco_ideal_sugerido ?? 0);

      return {
        id: item.id,
        nome: item.nome,
        sabor: item.sabor ?? null,
        sku: item.sku,
        preco_venda: precoVenda,
        custo: Number(item.preco_custo ?? 0),
        custo_receita: Number(item.custo_receita ?? 0),
        rateio_custos_fixos: Number(item.rateio_custos_fixos ?? 0),
        custo_total: custoTotal,
        margem: Number(item.margem ?? 0),
        margem_atual: calcularMargemAtual(precoVenda, custoTotal),
        preco_minimo: precoMinimo,
        preco_ideal_sugerido: precoIdealSugerido,
        preco_recomendado: calcularPrecoRecomendado(precoMinimo, precoIdealSugerido),
        ativo: item.ativo,
        created_at: item.created_at,
      };
    });
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

    await recalculateProductsFromCostDrivers();

    const precoVenda = Number(data.preco_venda ?? 0);
    const custoTotal = Number(data.custo_total ?? 0);
    const precoMinimo = Number(data.preco_minimo ?? 0);
    const precoIdealSugerido = Number(data.preco_ideal_sugerido ?? 0);

    return {
      id: data.id,
      nome: data.nome,
      sabor: data.sabor ?? null,
      sku: data.sku,
      preco_venda: precoVenda,
      custo: Number(data.preco_custo ?? 0),
      custo_receita: Number(data.custo_receita ?? 0),
      rateio_custos_fixos: Number(data.rateio_custos_fixos ?? 0),
      custo_total: custoTotal,
      margem: Number(data.margem ?? 0),
      margem_atual: calcularMargemAtual(precoVenda, custoTotal),
      preco_minimo: precoMinimo,
      preco_ideal_sugerido: precoIdealSugerido,
      preco_recomendado: calcularPrecoRecomendado(precoMinimo, precoIdealSugerido),
      ativo: data.ativo,
      created_at: data.created_at,
    };
  },

  async updateProduto(id: string, input: {
    nome: string;
    sku: string;
    preco_custo: number;
    preco_venda: number;
    ativo: boolean;
  }): Promise<Produto> {
    const { data, error } = await supabase
      .from("produtos")
      .update({
        nome: input.nome,
        sku: input.sku,
        preco_custo: input.preco_custo,
        preco_venda: input.preco_venda,
        ativo: input.ativo,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await recalculateProductsFromCostDrivers();

    const precoVenda = Number(data.preco_venda ?? 0);
    const custoTotal = Number(data.custo_total ?? 0);
    const precoMinimo = Number(data.preco_minimo ?? 0);
    const precoIdealSugerido = Number(data.preco_ideal_sugerido ?? 0);

    return {
      id: data.id,
      nome: data.nome,
      sabor: data.sabor ?? null,
      sku: data.sku,
      preco_venda: precoVenda,
      custo: Number(data.preco_custo ?? 0),
      custo_receita: Number(data.custo_receita ?? 0),
      rateio_custos_fixos: Number(data.rateio_custos_fixos ?? 0),
      custo_total: custoTotal,
      margem: Number(data.margem ?? 0),
      margem_atual: calcularMargemAtual(precoVenda, custoTotal),
      preco_minimo: precoMinimo,
      preco_ideal_sugerido: precoIdealSugerido,
      preco_recomendado: calcularPrecoRecomendado(precoMinimo, precoIdealSugerido),
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

  custosFixos: async (): Promise<CustoFixo[]> => {
    const { data, error } = await supabase.from("custos_fixos").select("*").order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria ?? null,
      valor_mensal: Number(item.valor_mensal ?? 0),
      data_vencimento: item.data_vencimento ?? null,
      status: item.status ?? "Ativo",
      observacao: item.observacao ?? null,
      created_at: item.created_at,
    }));
  },

  async createCustoFixo(input: {
    nome: string;
    categoria: string | null;
    valor_mensal: number;
    data_vencimento: string | null;
    status: "Ativo" | "Inativo";
    observacao: string | null;
  }): Promise<CustoFixo> {
    const { data, error } = await supabase
      .from("custos_fixos")
      .insert([{ nome: input.nome, categoria: input.categoria, valor_mensal: input.valor_mensal, data_vencimento: input.data_vencimento, status: input.status, observacao: input.observacao }])
      .select()
      .single();

    if (error) throw error;

    await recalculateProductsFromCostDrivers();
    await sincronizarNotificacoesFinanceiras();

    return {
      id: data.id,
      nome: data.nome,
      categoria: data.categoria ?? null,
      valor_mensal: Number(data.valor_mensal ?? 0),
      data_vencimento: data.data_vencimento ?? null,
      status: data.status ?? "Ativo",
      observacao: data.observacao ?? null,
      created_at: data.created_at,
    };
  },

  async updateCustoFixo(id: string, input: {
    nome: string;
    categoria: string | null;
    valor_mensal: number;
    data_vencimento: string | null;
    status: "Ativo" | "Inativo";
    observacao: string | null;
  }): Promise<CustoFixo> {
    const { data, error } = await supabase
      .from("custos_fixos")
      .update({ nome: input.nome, categoria: input.categoria, valor_mensal: input.valor_mensal, data_vencimento: input.data_vencimento, status: input.status, observacao: input.observacao })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await recalculateProductsFromCostDrivers();
    await sincronizarNotificacoesFinanceiras();

    return {
      id: data.id,
      nome: data.nome,
      categoria: data.categoria ?? null,
      valor_mensal: Number(data.valor_mensal ?? 0),
      data_vencimento: data.data_vencimento ?? null,
      status: data.status ?? "Ativo",
      observacao: data.observacao ?? null,
      created_at: data.created_at,
    };
  },

  async deleteCustoFixo(id: string): Promise<void> {
    const { error } = await supabase.from("custos_fixos").delete().eq("id", id);

    if (error) throw error;

    await recalculateProductsFromCostDrivers();
    await sincronizarNotificacoesFinanceiras();
  },

  parametrosFinanceiros: async (): Promise<ParametrosFinanceiros> => {
    const { data, error } = await supabase.from("parametros_financeiros").select("*").maybeSingle();

    if (error) throw error;

    return {
      id: data?.id ?? null,
      taxa_ifood: Number(data?.taxa_ifood ?? 0),
      taxa_99food: Number(data?.taxa_99food ?? 0),
      taxa_cartao: Number(data?.taxa_cartao ?? 0),
      comissao: Number(data?.comissao ?? 0),
      margem_lucro_desejada: Number(data?.margem_lucro_desejada ?? 0),
      percentual_perdas: Number(data?.percentual_perdas ?? 0),
      meta_mensal_vendas_unidades: Number(data?.meta_mensal_vendas_unidades ?? 0),
      created_at: data?.created_at ?? null,
    };
  },

  async upsertParametrosFinanceiros(input: {
    taxa_ifood: number;
    taxa_99food: number;
    taxa_cartao: number;
    comissao: number;
    margem_lucro_desejada: number;
    percentual_perdas: number;
    meta_mensal_vendas_unidades: number;
  }): Promise<ParametrosFinanceiros> {
    const existing = await supabase.from("parametros_financeiros").select("id").maybeSingle();

    if (existing.error) throw existing.error;

    const payload = {
      taxa_ifood: input.taxa_ifood,
      taxa_99food: input.taxa_99food,
      taxa_cartao: input.taxa_cartao,
      comissao: input.comissao,
      margem_lucro_desejada: input.margem_lucro_desejada,
      percentual_perdas: input.percentual_perdas,
      meta_mensal_vendas_unidades: input.meta_mensal_vendas_unidades,
    };

    const request = existing.data?.id
      ? supabase.from("parametros_financeiros").update(payload).eq("id", existing.data.id).select().single()
      : supabase.from("parametros_financeiros").insert([payload]).select().single();

    const { data, error } = await request;

    if (error) {
      const normalizedMessage = String(error.message ?? "");
      const isMissingColumn = error.code === "42703" || normalizedMessage.includes("does not exist");

      if (!isMissingColumn) {
        throw error;
      }

      const fallbackPayload = {
        taxa_ifood: input.taxa_ifood,
        taxa_99food: input.taxa_99food,
        taxa_cartao: input.taxa_cartao,
        comissao: input.comissao,
        margem_lucro_desejada: input.margem_lucro_desejada,
        percentual_perdas: input.percentual_perdas,
      };

      const fallbackRequest = existing.data?.id
        ? supabase.from("parametros_financeiros").update(fallbackPayload).eq("id", existing.data.id).select().single()
        : supabase.from("parametros_financeiros").insert([fallbackPayload]).select().single();

      const fallbackResult = await fallbackRequest;

      if (fallbackResult.error) {
        throw fallbackResult.error;
      }

      return {
        id: fallbackResult.data.id,
        taxa_ifood: Number(fallbackResult.data.taxa_ifood ?? 0),
        taxa_99food: Number(fallbackResult.data.taxa_99food ?? 0),
        taxa_cartao: Number(fallbackResult.data.taxa_cartao ?? 0),
        comissao: Number(fallbackResult.data.comissao ?? 0),
        margem_lucro_desejada: Number(fallbackResult.data.margem_lucro_desejada ?? 0),
        percentual_perdas: Number(fallbackResult.data.percentual_perdas ?? 0),
        meta_mensal_vendas_unidades: input.meta_mensal_vendas_unidades,
        created_at: fallbackResult.data.created_at ?? null,
      };
    }

    await recalculateProductsFromCostDrivers();

    return {
      id: data.id,
      taxa_ifood: Number(data.taxa_ifood ?? 0),
      taxa_99food: Number(data.taxa_99food ?? 0),
      taxa_cartao: Number(data.taxa_cartao ?? 0),
      comissao: Number(data.comissao ?? 0),
      margem_lucro_desejada: Number(data.margem_lucro_desejada ?? 0),
      percentual_perdas: Number(data.percentual_perdas ?? 0),
      meta_mensal_vendas_unidades: Number(data.meta_mensal_vendas_unidades ?? 0),
      created_at: data.created_at ?? null,
    };
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

    await recalculateProductsFromCostDrivers();

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

    await recalculateProductsFromCostDrivers();
  },

  estoque: async (): Promise<ItemEstoque[]> => {
    const { data, error } = await supabase
      .from("ingredientes")
      .select("id, nome, categoria, unidade, quantidade, estoque_minimo, observacao, created_at")
      .eq("ativo", true)
      .order("nome");

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      insumo: item.nome,
      categoria: item.categoria ?? null,
      unidade: item.unidade,
      quantidade: Number(item.quantidade ?? 0),
      minimo: Number(item.estoque_minimo ?? 0),
      observacao: item.observacao ?? null,
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
      observacao: item.observacao ?? null,
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
    observacao?: string | null;
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
          observacao: input.observacao ?? null,
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
    observacao?: string | null;
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
        observacao: input.observacao ?? null,
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
    await limparMovimentacoesOrfaas();
    await removerMovimentacoesAjustePorIngrediente(id);

    const [{ data: receitasVinculadas, error: receitasError }, { data: comprasVinculadas, error: comprasError }, { data: movimentacoesVinculadas, error: movimentacoesError }] = await Promise.all([
      supabase.from("receitas").select("id").eq("ingrediente_id", id).limit(1),
      supabase.from("itens_compra").select("id").eq("ingrediente_id", id).limit(1),
      supabase.from("movimentacoes_estoque").select("id").eq("ingrediente_id", id).neq("origem", "Ajuste").limit(1),
    ]);

    if (receitasError) throw receitasError;
    if (comprasError) throw comprasError;
    if (movimentacoesError) throw movimentacoesError;

    if ((receitasVinculadas ?? []).length > 0) {
      throw new Error("Não é possível excluir este item porque ele está sendo utilizado em uma receita.");
    }

    if ((comprasVinculadas ?? []).length > 0) {
      throw new Error("Não é possível excluir este item porque existem compras vinculadas.");
    }

    if ((movimentacoesVinculadas ?? []).length > 0) {
      throw new Error("Não é possível excluir este item porque existem movimentações de estoque vinculadas.");
    }

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

  async deleteProduto(id: string): Promise<void> {
    const { data: receitasVinculadas, error: receitasError } = await supabase
      .from("receitas")
      .select("id")
      .eq("produto_id", id)
      .limit(1);

    if (receitasError) throw receitasError;

    if ((receitasVinculadas ?? []).length > 0) {
      throw new Error("Não é possível excluir o produto porque existem receitas vinculadas a ele.");
    }

    const { error } = await supabase.from("produtos").delete().eq("id", id);

    if (error) throw error;
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

  async deleteCliente(id: string): Promise<void> {
    const { data: vendasVinculadas, error: vendasError } = await supabase
      .from("vendas")
      .select("id")
      .eq("cliente_id", id)
      .limit(1);

    if (vendasError) throw vendasError;

    if ((vendasVinculadas ?? []).length > 0) {
      throw new Error("Este cliente possui vendas registradas e não pode ser excluído.");
    }

    const { error } = await supabase.from("clientes").delete().eq("id", id);

    if (error) throw error;
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
    const { data: comprasVinculadas, error: comprasError } = await supabase
      .from("compras")
      .select("id")
      .eq("fornecedor_id", id);

    if (comprasError) throw comprasError;

    if ((comprasVinculadas ?? []).length > 0) {
      throw new Error("Não é possível excluir o fornecedor porque existem compras vinculadas a ele.");
    }

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

    const { data: contasPagar, error: contasPagarError } = await supabase
      .from("contas_pagar")
      .select("documento, status, valor_total, valor_pago, valor_aberto, data_pagamento, forma_pagamento, numero_parcela, total_parcelas, observacao, data_vencimento")
      .order("data", { ascending: false });

    if (contasPagarError) throw contasPagarError;

    return (data ?? []).map((item): Compra => {
      const contasRelacionadas = (contasPagar ?? []).filter((conta) => {
        const documento = String(conta.documento ?? "");
        return documento === String(item.id) || documento.startsWith(`${String(item.id)}-`);
      });

      const contaPrincipal = [...contasRelacionadas].sort((a, b) => {
        const parcelaA = Number(a.numero_parcela ?? 0);
        const parcelaB = Number(b.numero_parcela ?? 0);
        return parcelaA - parcelaB;
      })[0];

      const tipoPagamento = contasRelacionadas.some((conta) => {
        const valorAberto = Number((conta as Record<string, unknown>)["valor_aberto"] ?? 0);
        const valorPago = Number((conta as Record<string, unknown>)["valor_pago"] ?? 0);
        const valorTotal = Number((conta as Record<string, unknown>)["valor_total"] ?? 0);
        return valorAberto === 0 && valorPago >= valorTotal && Boolean((conta as Record<string, unknown>)["data_pagamento"]);
      })
        ? "avista"
        : "prazo";

      return {
        id: item.id,
        empresa_id: item.empresa_id ?? null,
        fornecedor_id: item.fornecedor_id ?? null,
        fornecedor_nome: item.fornecedor_nome ?? null,
        data_compra: item.data_compra,
        observacao: item.observacao ?? null,
        total: Number(item.total ?? 0),
        tipo_pagamento: tipoPagamento,
        forma_pagamento: typeof (contaPrincipal as Record<string, unknown> | undefined)?.["forma_pagamento"] === "string"
          ? (contaPrincipal as Record<string, unknown> | undefined)?.["forma_pagamento"] as string
          : null,
        data_pagamento: typeof (contaPrincipal as Record<string, unknown> | undefined)?.["data_pagamento"] === "string"
          ? (contaPrincipal as Record<string, unknown> | undefined)?.["data_pagamento"] as string
          : null,
        observacao_pagamento: typeof (contaPrincipal as Record<string, unknown> | undefined)?.["observacao"] === "string"
          ? (contaPrincipal as Record<string, unknown> | undefined)?.["observacao"] as string
          : null,
        parcelamento: contasRelacionadas.length > 1
          ? {
              parcelas: contasRelacionadas.length,
              intervaloDias: calcularIntervaloEntreVencimentos(contasRelacionadas as Array<Record<string, unknown>>),
            }
          : null,
        created_at: item.created_at,
        itens: (item.itens_compra ?? []).map((linha: Record<string, unknown>): ItemCompra => ({
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
      };
    });
  },

  async createCompra(input: {
    id?: string;
    empresa_id: string | null;
    fornecedor_id: string | null;
    fornecedor_nome: string | null;
    data_compra: string;
    observacao: string | null;
    total: number;
    tipo_pagamento?: "avista" | "prazo" | null;
    forma_pagamento?: string | null;
    data_pagamento?: string | null;
    observacao_pagamento?: string | null;
    parcelamento?: { parcelas: number; intervaloDias: number; primeiroVencimento?: string | null } | null;
    itens: Array<{
      ingrediente_id: string;
      ingrediente_nome: string | null;
      quantidade: number;
      unidade: string;
      valor_unitario: number;
      valor_total: number;
    }>;
  }): Promise<Compra> {
    const compraId = input.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `compra-${Date.now()}`);

    const compraPayload = {
      id: compraId,
      empresa_id: input.empresa_id,
      fornecedor_id: input.fornecedor_id,
      fornecedor_nome: input.fornecedor_nome,
      data_compra: input.data_compra,
      observacao: input.observacao,
      total: input.total,
    };

    const { data: compraCriada, error: compraError } = await supabase
      .from("compras")
      .insert([compraPayload])
      .select()
      .single();

    if (compraError) throw compraError;

    let compraPersistida = compraCriada as Record<string, unknown> | null;

    if (!compraPersistida) {
      const { data: compraRecuperada, error: recuperarError } = await supabase
        .from("compras")
        .select("*")
        .eq("id", compraId)
        .maybeSingle();

      if (recuperarError) throw recuperarError;

      if (!compraRecuperada) {
        throw new Error("Não foi possível localizar a compra criada.");
      }

      compraPersistida = compraRecuperada as Record<string, unknown>;
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

    await criarContaPagarParaCompra({
      id: compraId,
      fornecedor_nome: input.fornecedor_nome,
      total: input.total,
      data_compra: input.data_compra,
      tipo_pagamento: input.tipo_pagamento ?? null,
      forma_pagamento: input.forma_pagamento ?? null,
      data_pagamento: input.data_pagamento ?? null,
      observacao_pagamento: input.observacao_pagamento ?? null,
      parcelamento: input.parcelamento ?? null,
    });

    await recalculateProductsFromCostDrivers();

    return {
      id: compraId,
      empresa_id: (compraCriada?.["empresa_id"] as string | null) ?? null,
      fornecedor_id: (compraCriada?.["fornecedor_id"] as string | null) ?? null,
      fornecedor_nome: (compraCriada?.["fornecedor_nome"] as string | null) ?? null,
      data_compra: (compraCriada?.["data_compra"] as string) ?? input.data_compra,
      observacao: (compraCriada?.["observacao"] as string | null) ?? null,
      total: Number(compraCriada?.["total"] ?? 0),
      tipo_pagamento: input.tipo_pagamento ?? null,
      forma_pagamento: input.forma_pagamento ?? null,
      data_pagamento: input.data_pagamento ?? null,
      observacao_pagamento: input.observacao_pagamento ?? null,
      parcelamento: input.parcelamento ?? null,
      created_at: (compraCriada?.["created_at"] as string) ?? new Date().toISOString(),
      itens: itensPayload.map((item) => ({
        id: `${compraId}-${item.ingrediente_id}`,
        compra_id: compraId,
        ingrediente_id: item.ingrediente_id,
        ingrediente_nome: item.ingrediente_nome,
        quantidade: Number(item.quantidade ?? 0),
        unidade: item.unidade,
        valor_unitario: Number(item.valor_unitario ?? 0),
        valor_total: Number(item.valor_total ?? 0),
        created_at: (compraCriada?.["created_at"] as string) ?? new Date().toISOString(),
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
    tipo_pagamento?: "avista" | "prazo" | null;
    forma_pagamento?: string | null;
    data_pagamento?: string | null;
    observacao_pagamento?: string | null;
    parcelamento?: { parcelas: number; intervaloDias: number; primeiroVencimento?: string | null } | null;
    itens: Array<{
      ingrediente_id: string;
      ingrediente_nome: string | null;
      quantidade: number;
      unidade: string;
      valor_unitario: number;
      valor_total: number;
    }>;
  }): Promise<Compra> {
    await this.deleteCompra(id);

    return this.createCompra({
      id,
      empresa_id: input.empresa_id,
      fornecedor_id: input.fornecedor_id,
      fornecedor_nome: input.fornecedor_nome,
      data_compra: input.data_compra,
      observacao: input.observacao,
      total: input.total,
      tipo_pagamento: input.tipo_pagamento ?? null,
      forma_pagamento: input.forma_pagamento ?? null,
      data_pagamento: input.data_pagamento ?? null,
      observacao_pagamento: input.observacao_pagamento ?? null,
      parcelamento: input.parcelamento ?? null,
      itens: input.itens,
    });
  },

  async deleteCompra(id: string): Promise<void> {
    await limparMovimentacoesOrfaas();

    const { data: movimentosCompra, error: movimentosFetchError } = await supabase
      .from("movimentacoes_estoque")
      .select("id, ingrediente_id, quantidade")
      .eq("origem", "Compra")
      .eq("documento", `compra-${id}`);

    if (movimentosFetchError) throw movimentosFetchError;

    if ((movimentosCompra ?? []).length > 0) {
      const { error: deleteMovementsError } = await supabase
        .from("movimentacoes_estoque")
        .delete()
        .in("id", (movimentosCompra ?? []).map((movimentacao) => movimentacao.id));

      if (deleteMovementsError) throw deleteMovementsError;
    }

    const { data: itensCompra, error: itensFetchError } = await supabase
      .from("itens_compra")
      .select("ingrediente_id, quantidade, valor_unitario")
      .eq("compra_id", id);

    if (itensFetchError) throw itensFetchError;

    for (const item of itensCompra ?? []) {
      const { data: ingredienteAtual, error: ingredienteFetchError } = await supabase
        .from("ingredientes")
        .select("quantidade, custo_unitario")
        .eq("id", item.ingrediente_id)
        .maybeSingle();

      if (ingredienteFetchError) throw ingredienteFetchError;

      const estoqueAnterior = Number(ingredienteAtual?.quantidade ?? 0);
      const quantidadeRemovida = Number(item.quantidade ?? 0);
      const estoquePosterior = Math.max(0, estoqueAnterior - quantidadeRemovida);
      const custoUnitarioAtual = Number(ingredienteAtual?.custo_unitario ?? 0);
      const custoUnitarioRemovido = Number(item.valor_unitario ?? 0);
      const novoCustoUnitario = estoquePosterior > 0
        ? Math.max(0, (custoUnitarioAtual * estoqueAnterior - custoUnitarioRemovido * quantidadeRemovida) / estoquePosterior)
        : 0;

      const { error: estoqueUpdateError } = await supabase
        .from("ingredientes")
        .update({
          quantidade: estoquePosterior,
          custo_unitario: novoCustoUnitario,
        })
        .eq("id", item.ingrediente_id);

      if (estoqueUpdateError) throw estoqueUpdateError;

      await recalcularReceitasPorIngrediente(item.ingrediente_id);
    }

    const { data: contasRelacionadas, error: contasFetchError } = await supabase
      .from("contas_pagar")
      .select("id")
      .eq("documento", id);

    if (contasFetchError) throw contasFetchError;

    const contasParceladas = await supabase
      .from("contas_pagar")
      .select("id")
      .like("documento", `${id}-%`);

    if (contasParceladas.error) throw contasParceladas.error;

    const idsContas = [...new Set([...(contasRelacionadas ?? []).map((conta) => conta.id), ...(contasParceladas.data ?? []).map((conta) => conta.id)])];

    if (idsContas.length > 0) {
      const { error: deleteContasError } = await supabase.from("contas_pagar").delete().in("id", idsContas);

      if (deleteContasError) throw deleteContasError;
    }

    const { error: deleteItensError } = await supabase.from("itens_compra").delete().eq("compra_id", id);

    if (deleteItensError) throw deleteItensError;

    const { error } = await supabase.from("compras").delete().eq("id", id);

    if (error) throw error;

    await recalculateProductsFromCostDrivers();
  },

  async deleteVenda(id: string): Promise<void> {
    await limparMovimentacoesOrfaas();

    const { data: venda, error: vendaFetchError } = await supabase
      .from("vendas")
      .select("numero")
      .eq("id", id)
      .maybeSingle();

    if (vendaFetchError) throw vendaFetchError;

    const { data: itensVenda, error: itensFetchError } = await supabase
      .from("itens_venda")
      .select("produto_id, quantidade")
      .eq("venda_id", id);

    if (itensFetchError) throw itensFetchError;

    const adicoesPorIngrediente = await calcularEstornoEstoqueVenda(
      (itensVenda ?? []).map((item) => ({
        produto_id: item.produto_id as string,
        quantidade: Number(item.quantidade ?? 0),
      })),
    );

    await aplicarEstornoEstoqueVenda(id, adicoesPorIngrediente);

    const { data: movimentosVenda, error: movimentosFetchError } = await supabase
      .from("movimentacoes_estoque")
      .select("id")
      .eq("origem", "Venda")
      .eq("documento", `venda-${id}`);

    if (movimentosFetchError) throw movimentosFetchError;

    if ((movimentosVenda ?? []).length > 0) {
      const { error: deleteMovementsError } = await supabase
        .from("movimentacoes_estoque")
        .delete()
        .in("id", (movimentosVenda ?? []).map((movimentacao) => movimentacao.id));

      if (deleteMovementsError) throw deleteMovementsError;
    }

    const { data: contasReceberRelacionadas, error: contasFetchError } = await supabase
      .from("contas_receber")
      .select("id")
      .eq("documento", venda?.numero ?? id);

    if (contasFetchError) throw contasFetchError;

    const { data: contasReceberPorId, error: contasPorIdError } = await supabase
      .from("contas_receber")
      .select("id")
      .eq("documento", id);

    if (contasPorIdError) throw contasPorIdError;

    const idsContas = [...new Set([...(contasReceberRelacionadas ?? []).map((conta) => conta.id), ...(contasReceberPorId ?? []).map((conta) => conta.id)])];

    if (idsContas.length > 0) {
      const { error: deleteContasError } = await supabase.from("contas_receber").delete().in("id", idsContas);

      if (deleteContasError) throw deleteContasError;
    }

    const { error: deleteItensError } = await supabase.from("itens_venda").delete().eq("venda_id", id);

    if (deleteItensError) throw deleteItensError;

    const { error: deleteVendaError } = await supabase.from("vendas").delete().eq("id", id);

    if (deleteVendaError) throw deleteVendaError;

    await recalculateProductsFromCostDrivers();
    await sincronizarNotificacoesFinanceiras();
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
      status: normalizarStatusContaReceber(item.status as string | null | undefined),
      data_emissao: item.data_emissao ?? null,
      data_vencimento: item.data_vencimento ?? null,
      data_recebimento: item.data_recebimento ?? null,
      valor_total: Number(item.valor_total ?? item.valor ?? 0),
      valor_recebido: Number(item.valor_recebido ?? 0),
      valor_aberto: Number(item.valor_aberto ?? Number(item.valor_total ?? item.valor ?? 0)),
      forma_recebimento: item.forma_recebimento ?? null,
      numero_parcela: item.numero_parcela ?? null,
      total_parcelas: item.total_parcelas ?? null,
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
      status: normalizarStatusContaPagar(item.status as string | null | undefined),
      data_emissao: item.data_emissao ?? null,
      data_vencimento: item.data_vencimento ?? null,
      data_pagamento: item.data_pagamento ?? null,
      valor_total: Number(item.valor_total ?? item.valor ?? 0),
      valor_pago: Number(item.valor_pago ?? 0),
      valor_aberto: Number(item.valor_aberto ?? Number(item.valor_total ?? item.valor ?? 0)),
      forma_pagamento: item.forma_pagamento ?? null,
      numero_parcela: item.numero_parcela ?? null,
      total_parcelas: item.total_parcelas ?? null,
      observacao: item.observacao ?? null,
      created_at: item.created_at,
    }));
  },

  async marcarContaPagarComoPago(
    id: string,
    dataPagamento: string,
    valorPagamento?: number,
    formaPagamento?: string | null,
    observacao?: string | null,
  ): Promise<void> {
    const { data: conta, error: fetchError } = await supabase
      .from("contas_pagar")
      .select("valor_total, valor_pago, valor_aberto, data_vencimento")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const valorTotal = Number(conta?.valor_total ?? 0);
    const valorPagoAtual = Number(conta?.valor_pago ?? 0);
    const valorRestanteAtual = Math.max(0, valorTotal - valorPagoAtual);
    const valorParcial = valorPagamento ?? valorRestanteAtual;
    const valorNovoPago = Math.min(valorTotal, valorPagoAtual + valorParcial);
    const valorAberto = Math.max(0, valorTotal - valorNovoPago);
    const statusUI = calcularStatusContaPagar({
      valorPago: valorNovoPago,
      valorTotal,
      dataVencimento: conta?.data_vencimento as string | null,
    });
    const status = normalizarStatusParaDb(statusUI, "pagar");

    const { error: updateError } = await supabase
      .from("contas_pagar")
      .update({
        status,
        data_pagamento: dataPagamento,
        valor_pago: valorNovoPago,
        valor_aberto: valorAberto,
        forma_pagamento: formaPagamento ?? null,
        observacao: observacao ?? null,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    await sincronizarNotificacoesFinanceiras();
  },

  async pagarCustoFixo(
    id: string,
    input: {
      dataPagamento: string;
      formaPagamento?: string | null;
      observacao?: string | null;
      valorPagamento?: number;
    },
  ): Promise<void> {
    const { data: custo, error: fetchError } = await supabase
      .from("custos_fixos")
      .select("id, nome, valor_mensal, data_vencimento")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!custo) throw new Error("Custo fixo não encontrado.");

    const valorTotal = Number(custo.valor_mensal ?? 0);
    const documento = `custo-fixo:${id}`;
    const { data: contaExistente, error: contaError } = await supabase
      .from("contas_pagar")
      .select("id")
      .eq("documento", documento)
      .maybeSingle();

    if (contaError) throw contaError;

    const payload = {
      empresa_id: null,
      categoria_id: null,
      documento,
      origem: "Custo Fixo",
      descricao: `Pagamento de ${custo.nome}`,
      valor: valorTotal,
      data: input.dataPagamento,
      data_emissao: input.dataPagamento,
      data_vencimento: (custo.data_vencimento as string | null) ?? input.dataPagamento,
      valor_total: valorTotal,
      valor_pago: valorTotal,
      valor_aberto: 0,
      forma_pagamento: input.formaPagamento ?? null,
      numero_parcela: 1,
      total_parcelas: 1,
      status: "Pago",
      data_pagamento: input.dataPagamento,
      observacao: input.observacao ?? `Pagamento de custo fixo ${custo.nome}`,
    };

    if (contaExistente) {
      const { error } = await supabase.from("contas_pagar").update(payload).eq("id", contaExistente.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("contas_pagar").insert([payload]);
      if (error) throw error;
    }

    await sincronizarNotificacoesFinanceiras();
  },

  async reabrirContaPagar(id: string): Promise<void> {
    const { data: conta, error: fetchError } = await supabase
      .from("contas_pagar")
      .select("valor_total")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const valorTotal = Number(conta?.valor_total ?? 0);

    const { error } = await supabase
      .from("contas_pagar")
      .update({
        status: "Pendente",
        data_pagamento: null,
        valor_pago: 0,
        valor_aberto: valorTotal,
        forma_pagamento: null,
      })
      .eq("id", id);

    if (error) throw error;

    await sincronizarNotificacoesFinanceiras();
  },

  async marcarContaReceberComoRecebido(
    id: string,
    dataRecebimento: string,
    valorRecebimento?: number,
    formaRecebimento?: string | null,
    observacao?: string | null,
  ): Promise<void> {
    const { data: conta, error: fetchError } = await supabase
      .from("contas_receber")
      .select("valor_total, valor_recebido, valor_aberto, data_vencimento")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const valorTotal = Number(conta?.valor_total ?? 0);
    const valorRecebidoAtual = Number(conta?.valor_recebido ?? 0);
    const valorParcial = valorRecebimento ?? valorTotal;
    const valorNovoRecebido = Math.min(valorTotal, valorRecebidoAtual + valorParcial);
    const valorAberto = Math.max(0, valorTotal - valorNovoRecebido);
    const status = calcularStatusContaReceber({
      valorRecebido: valorNovoRecebido,
      valorTotal,
      dataVencimento: conta?.data_vencimento as string | null,
    });

    const { error } = await supabase
      .from("contas_receber")
      .update({
        status: normalizarStatusParaDb(status, "receber"),
        data_recebimento: dataRecebimento,
        valor_recebido: valorNovoRecebido,
        valor_aberto: valorAberto,
        forma_recebimento: formaRecebimento ?? null,
        observacao: observacao ?? null,
      })
      .eq("id", id);

    if (error) throw error;

    await sincronizarNotificacoesFinanceiras();
  },

  async reabrirContaReceber(id: string): Promise<void> {
    const { data: conta, error: fetchError } = await supabase
      .from("contas_receber")
      .select("valor_total")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const valorTotal = Number(conta?.valor_total ?? 0);

    const { error } = await supabase
      .from("contas_receber")
      .update({
        status: "Pendente",
        data_recebimento: null,
        valor_recebido: 0,
        valor_aberto: valorTotal,
        forma_recebimento: null,
      })
      .eq("id", id);

    if (error) throw error;

    await sincronizarNotificacoesFinanceiras();
  },

  async createDespesaManual(input: {
    empresa_id: string | null;
    descricao: string;
    categoria_id: string | null;
    fornecedor: string | null;
    valor: number;
    data: string;
    observacao: string | null;
    status: "Pendente" | "Pago";
    dataVencimento?: string | null;
    formaPagamento?: string | null;
  }): Promise<void> {
    const dataVencimento = input.dataVencimento ?? new Date(input.data).toISOString().slice(0, 10);
    const valorPago = input.status === "Pago" ? input.valor : 0;
    const valorAberto = input.valor - valorPago;
    const status = calcularStatusContaPagar({ valorPago, valorTotal: input.valor, dataVencimento });

    const { error } = await supabase.from("contas_pagar").insert([{
      empresa_id: input.empresa_id,
      categoria_id: input.categoria_id,
      categoria: input.categoria_id ?? null,
      origem: input.fornecedor ?? "Fornecedor",
      descricao: input.descricao,
      valor: input.valor,
      data: input.data,
      data_emissao: input.data,
      data_vencimento: dataVencimento,
      valor_total: input.valor,
      valor_pago: valorPago,
      valor_aberto: valorAberto,
      forma_pagamento: input.formaPagamento ?? null,
      numero_parcela: 1,
      total_parcelas: 1,
      status: normalizarStatusParaDb(status, "pagar"),
      data_pagamento: input.status === "Pago" ? input.data : null,
      observacao: input.observacao,
    }]);

    if (error) throw error;

    await sincronizarNotificacoesFinanceiras();
  },

  async createReceitaManual(input: {
    empresa_id: string | null;
    descricao: string;
    categoria_id: string | null;
    cliente: string | null;
    valor: number;
    data: string;
    observacao: string | null;
    status: "Pendente" | "Recebido";
    dataVencimento?: string | null;
    formaRecebimento?: string | null;
  }): Promise<void> {
    const dataVencimento = input.dataVencimento ?? new Date(input.data).toISOString().slice(0, 10);
    const valorRecebido = input.status === "Recebido" ? input.valor : 0;
    const valorAberto = input.valor - valorRecebido;
    const status = calcularStatusContaReceber({ valorRecebido, valorTotal: input.valor, dataVencimento });

    const { error } = await supabase.from("contas_receber").insert([{
      empresa_id: input.empresa_id,
      categoria_id: input.categoria_id,
      categoria: input.categoria_id ?? null,
      origem: input.cliente ?? "Cliente",
      descricao: input.descricao,
      valor: input.valor,
      data: input.data,
      data_emissao: input.data,
      data_vencimento: dataVencimento,
      valor_total: input.valor,
      valor_recebido: valorRecebido,
      valor_aberto: valorAberto,
      forma_recebimento: input.formaRecebimento ?? null,
      numero_parcela: 1,
      total_parcelas: 1,
      status: normalizarStatusParaDb(status, "receber"),
      data_recebimento: input.status === "Recebido" ? input.data : null,
      observacao: input.observacao,
    }]);

    if (error) throw error;

    await sincronizarNotificacoesFinanceiras();
  },

  lancamentos: () => empty<Lancamento>(),
  metas: () => empty<Meta>(),

  async dashboardAlertas(): Promise<DashboardAlerta[]> {
    const hoje = new Date();
    const hojeString = hoje.toISOString().slice(0, 10);
    const seteDias = new Date(hoje);
    seteDias.setDate(hoje.getDate() + 7);
    const seteDiasString = seteDias.toISOString().slice(0, 10);

    const [{ data: contas }, { data: metas }, { data: custosFixos }, { data: produtos }] = await Promise.all([
      supabase.from("contas_pagar").select("id, descricao, data_vencimento, valor_total, status"),
      supabase.from("metas").select("id, periodo, alvo, realizado"),
      supabase.from("custos_fixos").select("id, nome, data_vencimento, valor_mensal, status").eq("status", "Ativo"),
      supabase.from("produtos").select("id, nome, preco_venda, preco_minimo, custo_total"),
    ]);

    const estoqueCritico = await listarItensEstoqueCritico();

    const alertas: DashboardAlerta[] = [];

    const contasVencidas = (contas ?? []).filter((conta) => {
      const vencimento = conta.data_vencimento as string | null;
      const status = normalizarStatusFinanceiro(conta.status as string | null | undefined);
      return vencimento != null && vencimento < hojeString && status !== "Pago" && status !== "Recebido";
    });

    if (contasVencidas.length > 0) {
      alertas.push({
        id: "contas-vencidas-resumo",
        tipo: "contas-vencidas",
        titulo: `${contasVencidas.length} contas vencidas`,
        descricao: "Há contas pendentes que já passaram do vencimento.",
        prioridade: "alta",
        link: "/financeiro",
        valor: contasVencidas.reduce((total, conta) => total + Number(conta.valor_total ?? 0), 0),
      });
    }

    const custosFixosVencendo = (custosFixos ?? []).filter((custo) => {
      const vencimento = custo.data_vencimento as string | null;
      return vencimento != null && vencimento <= seteDiasString && vencimento >= hojeString;
    });

    if (custosFixosVencendo.length > 0) {
      alertas.push({
        id: "custos-fixos-vencendo",
        tipo: "custos-fixos-vencendo",
        titulo: `${custosFixosVencendo.length} custo(s) fixo(s) vence(m) em breve`,
        descricao: "Revise os próximos vencimentos da operação.",
        prioridade: "media",
        link: "/custos-fixos",
        valor: custosFixosVencendo.reduce((total, custo) => total + Number(custo.valor_mensal ?? 0), 0),
      });
    }

    if (estoqueCritico.length > 0) {
      alertas.push({
        id: "estoque-critico-resumo",
        tipo: "estoque-critico",
        titulo: `${estoqueCritico.length} ingrediente(s) em estoque crítico`,
        descricao: "Ajuste a reposição para evitar faltas de produção.",
        prioridade: "alta",
        link: "/estoque",
        valor: estoqueCritico.length,
      });
    }

    const produtosAbaixoDoMinimo = (produtos ?? []).filter((produto) => {
      const precoVenda = Number(produto.preco_venda ?? 0);
      const precoMinimo = Number(produto.preco_minimo ?? 0);
      return precoVenda > 0 && precoMinimo > 0 && precoVenda < precoMinimo;
    });

    if (produtosAbaixoDoMinimo.length > 0) {
      alertas.push({
        id: "preco-abaixo-minimo",
        tipo: "preco-abaixo-minimo",
        titulo: `${produtosAbaixoDoMinimo.length} produto(s) abaixo do preço mínimo`,
        descricao: "Revise os preços para preservar a margem desejada.",
        prioridade: "media",
        link: "/produtos",
        valor: produtosAbaixoDoMinimo.length,
      });
    }

    const produtosMargemNegativa = (produtos ?? []).filter((produto) => {
      const precoVenda = Number(produto.preco_venda ?? 0);
      const custoTotal = Number(produto.custo_total ?? 0);
      return precoVenda > 0 && custoTotal > 0 && custoTotal >= precoVenda;
    });

    if (produtosMargemNegativa.length > 0) {
      alertas.push({
        id: "margem-negativa",
        tipo: "margem-negativa",
        titulo: `${produtosMargemNegativa.length} produto(s) com margem negativa`,
        descricao: "A rentabilidade do catálogo precisa de ajuste.",
        prioridade: "alta",
        link: "/produtos",
        valor: produtosMargemNegativa.length,
      });
    }

    const metaMes = (metas ?? []).find((meta) => {
      const periodo = String(meta.periodo ?? "").slice(0, 7);
      return periodo === hoje.toISOString().slice(0, 7);
    });

    const alvo = Number(metaMes?.alvo ?? 0);
    const realizado = Number(metaMes?.realizado ?? 0);
    const percentual = alvo > 0 ? Math.min(100, Math.round((realizado / alvo) * 100)) : 0;
    if (percentual < 70) {
      alertas.push({
        id: "meta-abaixo",
        tipo: "meta-abaixo",
        titulo: "Meta mensal abaixo de 70%",
        descricao: `${percentual}% do alvo atingido`,
        prioridade: "alta",
        link: "/metas",
        valor: percentual,
      });
    }

    return alertas.sort((a, b) => {
      const prioridadePeso = { alta: 0, media: 1, baixa: 2 };
      return prioridadePeso[a.prioridade] - prioridadePeso[b.prioridade];
    });
  },

  async dashboardCustosFixos(): Promise<DashboardCustosFixos> {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1).toISOString().slice(0, 10);

    const [{ data: comprasMes }, { data: vendasMes }, { data: custosFixosAtivos }] = await Promise.all([
      supabase.from("compras").select("total").gte("data_compra", inicioMes).lt("data_compra", fimMes),
      supabase.from("vendas").select("total, taxa_plataforma, itens_venda(*)").gte("data_venda", inicioMes).lt("data_venda", fimMes),
      supabase.from("custos_fixos").select("valor_mensal, status").eq("status", "Ativo"),
    ]);

    const comprasMesTotal = (comprasMes ?? []).reduce((total, item) => total + Number(item.total ?? 0), 0);
    const faturamentoMes = (vendasMes ?? []).reduce((total, item) => total + Number(item.total ?? 0), 0);
    const taxasFinanceirasMes = (vendasMes ?? []).reduce((total, item) => total + Number(item.taxa_plataforma ?? 0), 0);
    const custosFixosMes = (custosFixosAtivos ?? []).reduce((total, item) => total + Number(item.valor_mensal ?? 0), 0);
    const produtosVendidosMes = (vendasMes ?? []).reduce((total, venda) => {
      const itensVenda = (venda as Record<string, unknown>)["itens_venda"] as Array<Record<string, unknown>> | undefined;
      const quantidadeVendida = (itensVenda ?? []).reduce((subtotal, item) => subtotal + Number(item["quantidade"] ?? 0), 0);

      return total + quantidadeVendida;
    }, 0);
    const lucroBruto = calcularLucroBruto(faturamentoMes, comprasMesTotal);
    const lucroLiquido = calcularLucroLiquido(faturamentoMes, comprasMesTotal, custosFixosMes, taxasFinanceirasMes);
    const margemLiquida = faturamentoMes > 0 ? (lucroLiquido / faturamentoMes) * 100 : 0;
    const percentualCustosFixosSobreFaturamento = faturamentoMes > 0 ? (custosFixosMes / faturamentoMes) * 100 : 0;
    const rateioCustosFixosPorProduto = produtosVendidosMes > 0 ? custosFixosMes / produtosVendidosMes : 0;
    const pontoEquilibrio = margemLiquida > 0 ? custosFixosMes / (margemLiquida / 100) : custosFixosMes;

    return {
      compras_mes: comprasMesTotal,
      custos_fixos_mes: custosFixosMes,
      produtos_vendidos_mes: produtosVendidosMes,
      percentual_custos_fixos_sobre_faturamento: percentualCustosFixosSobreFaturamento,
      rateio_custos_fixos_por_produto: rateioCustosFixosPorProduto,
      faturamento_mes: faturamentoMes,
      lucro_bruto: lucroBruto,
      lucro_liquido: lucroLiquido,
      margem_liquida: margemLiquida,
      ponto_equilibrio: pontoEquilibrio,
    };
  },

  async dashboardFinanceiro(): Promise<DashboardFinanceiro> {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1).toISOString().slice(0, 10);
    const hojeString = hoje.toISOString().slice(0, 10);
    const seteDias = new Date(hoje);
    seteDias.setDate(hoje.getDate() + 7);
    const seteDiasString = seteDias.toISOString().slice(0, 10);

    const [{ data: contasReceberMes }, { data: contasPagarMes }, { data: vendasMes }, { data: custosFixosAtivos }] = await Promise.all([
      supabase.from("contas_receber").select("valor, valor_total, valor_recebido, valor_aberto, status, data_vencimento").gte("data", inicioMes).lt("data", fimMes),
      supabase.from("contas_pagar").select("valor, valor_total, valor_pago, valor_aberto, status, data_vencimento").gte("data", inicioMes).lt("data", fimMes),
      supabase.from("vendas").select("id, total, taxa_plataforma").gte("data_venda", inicioMes).lt("data_venda", fimMes),
      supabase.from("custos_fixos").select("valor_mensal, status").eq("status", "Ativo"),
    ]);

    const contasReceberMesNormalizadas = (contasReceberMes ?? []) as Array<Record<string, unknown>>;
    const contasPagarMesNormalizadas = (contasPagarMes ?? []) as Array<Record<string, unknown>>;
    const contasDoMes = [...contasReceberMesNormalizadas, ...contasPagarMesNormalizadas];
    const vendasDoMes = (vendasMes ?? []) as Array<Record<string, unknown>>;

    const idsVendasMes = vendasDoMes.map((venda) => venda["id"] as string | null).filter(Boolean) as string[];
    let custosVariaveisMes = 0;

    if (idsVendasMes.length > 0) {
      const { data: itensMes } = await supabase
        .from("itens_venda")
        .select("quantidade, venda_id, produto_id")
        .in("venda_id", idsVendasMes);

      const itensVendaMes = (itensMes ?? []) as Array<Record<string, unknown>>;
      const produtoIds = [...new Set(itensVendaMes.map((item) => item["produto_id"] as string | null).filter(Boolean) as string[])];

      if (produtoIds.length > 0) {
        const { data: produtos } = await supabase.from("produtos").select("id, preco_custo").in("id", produtoIds);
        const custosPorProduto = new Map<string, number>((produtos ?? []).map((produto) => [produto.id as string, Number(produto.preco_custo ?? 0)]));
        custosVariaveisMes = calcularCustosVariaveisPorItens(itensVendaMes, custosPorProduto);
      }
    }

    const receitasDoMes = vendasDoMes.reduce((total, item) => total + Number(item["total"] ?? 0), 0);
    const taxasFinanceirasMes = vendasDoMes.reduce((total, item) => total + Number(item["taxa_plataforma"] ?? 0), 0);
    const custosFixosMes = (custosFixosAtivos ?? []).reduce((total, item) => total + Number(item.valor_mensal ?? 0), 0);
    const despesasDoMes = custosVariaveisMes + custosFixosMes + taxasFinanceirasMes;
    const contasAPagar = contasPagarMesNormalizadas.filter((item) => {
      const status = normalizarStatusFinanceiro(item["status"] as string | null | undefined);
      return status !== "Pago";
    }).reduce((total, item) => total + Number(item["valor_aberto"] ?? item["valor_total"] ?? item["valor"] ?? 0), 0);
    const contasAReceber = contasReceberMesNormalizadas.filter((item) => {
      const status = normalizarStatusFinanceiro(item["status"] as string | null | undefined);
      return status !== "Recebido";
    }).reduce((total, item) => total + Number(item["valor_aberto"] ?? item["valor_total"] ?? item["valor"] ?? 0), 0);
    const contasVencidas = contasDoMes.filter((item) => {
      const vencimento = item["data_vencimento"] as string | null;
      const status = normalizarStatusFinanceiro(item["status"] as string | null | undefined);
      return vencimento && vencimento < hojeString && status !== "Pago" && status !== "Recebido";
    }).length;
    const contasVencendo7Dias = contasDoMes.filter((item) => {
      const vencimento = item["data_vencimento"] as string | null;
      const status = normalizarStatusFinanceiro(item["status"] as string | null | undefined);
      return vencimento && vencimento >= hojeString && vencimento <= seteDiasString && status !== "Pago" && status !== "Recebido";
    }).length;
    const totalEmAberto = contasPagarMesNormalizadas.reduce((total, item) => total + Number(item["valor_aberto"] ?? item["valor_total"] ?? item["valor"] ?? 0), 0) + contasReceberMesNormalizadas.reduce((total, item) => total + Number(item["valor_aberto"] ?? item["valor_total"] ?? item["valor"] ?? 0), 0);
    const totalRecebido = contasReceberMesNormalizadas.reduce((total, item) => total + Number(item["valor_recebido"] ?? 0), 0);
    const totalPago = contasPagarMesNormalizadas.reduce((total, item) => total + Number(item["valor_pago"] ?? 0), 0);
    const caixaDisponivel = calcularCaixaDisponivel(0, totalRecebido, totalPago);

    return {
      receitas_do_mes: receitasDoMes,
      despesas_do_mes: despesasDoMes,
      saldo: caixaDisponivel,
      lucro_liquido: calcularLucroLiquido(receitasDoMes, custosVariaveisMes, custosFixosMes, taxasFinanceirasMes),
      contas_a_pagar: contasAPagar,
      contas_a_receber: contasAReceber,
      contas_vencidas: contasVencidas,
      contas_vencendo_7_dias: contasVencendo7Dias,
      total_em_aberto: totalEmAberto,
      total_recebido: totalRecebido,
      total_pago: totalPago,
    };
  },

  async notificacoes(): Promise<Notificacao[]> {
    await sincronizarNotificacoesFinanceiras();

    const { data, error } = await supabase.from("notificacoes").select("*").order("data", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      descricao: item.descricao,
      prioridade: item.prioridade,
      lida: Boolean(item.lida),
      data: item.data,
      origem: item.origem,
      valor: item.valor != null ? Number(item.valor ?? 0) : null,
      data_vencimento: item.data_vencimento ?? null,
      dias_restantes: item.dias_restantes != null ? Number(item.dias_restantes ?? 0) : null,
      link: item.link ?? null,
      referencia_id: item.referencia_id ?? null,
      referencia_tipo: item.referencia_tipo ?? null,
      created_at: item.created_at,
    }));
  },

  async marcarNotificacoesComoLidas(): Promise<void> {
    const { error } = await supabase.from("notificacoes").update({ lida: true });

    if (error) throw error;
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
        .select("id, total, lucro_estimado, data_venda, plataforma, taxa_plataforma")
        .gte("data_venda", inicioHoje)
        .lt("data_venda", fimHoje);

      if (vendasHojeError) {
        throw vendasHojeError;
      }

      const vendasDoDia = Array.isArray(vendasHoje) ? vendasHoje : [];
      const idsVendasHoje = vendasDoDia.map((venda) => venda.id).filter(Boolean);

      const receitaHoje = vendasDoDia.reduce((soma, venda) => soma + Number(venda.total ?? 0), 0);
      const taxasFinanceirasHoje = vendasDoDia.reduce((soma, venda) => soma + Number(venda.taxa_plataforma ?? 0), 0);
      const pedidosHoje = vendasDoDia.length;
      const pedidosIfoodHoje = vendasDoDia.filter((venda) => String(venda.plataforma ?? "").toLowerCase() === "ifood").length;
      const pedidosBalcaoHoje = vendasDoDia.filter((venda) => String(venda.plataforma ?? "").toLowerCase() === "balcao").length;

      let cookiesHoje = 0;
      let produtosVendidosHoje = 0;
      let custoVariavelHoje = 0;

      if (idsVendasHoje.length > 0) {
        const { data: itensHoje, error: itensHojeError } = await supabase
          .from("itens_venda")
          .select("quantidade, venda_id, produto_id")
          .in("venda_id", idsVendasHoje);

        if (!itensHojeError) {
          const itensDoDia = Array.isArray(itensHoje) ? itensHoje : [];
          cookiesHoje = itensDoDia.reduce((soma, item) => soma + Number(item.quantidade ?? 0), 0);
          produtosVendidosHoje = cookiesHoje;

          const produtoIds = [...new Set(itensDoDia.map((item) => item.produto_id as string | null).filter(Boolean))];

          if (produtoIds.length > 0) {
            const { data: produtos, error: produtosError } = await supabase
              .from("produtos")
              .select("id, preco_custo")
              .in("id", produtoIds);

            if (!produtosError) {
              const custosPorProduto = new Map<string, number>(
                (produtos ?? []).map((produto) => [produto.id as string, Number(produto.preco_custo ?? 0)]),
              );

              custoVariavelHoje = itensDoDia.reduce((soma, item) => {
                const produtoId = item.produto_id as string | null;
                const custoUnitario = produtoId ? custosPorProduto.get(produtoId) ?? 0 : 0;
                return soma + custoUnitario * Number(item.quantidade ?? 0);
              }, 0);
            }
          }
        }
      }

      const { data: custosFixosAtivos } = await supabase
        .from("custos_fixos")
        .select("valor_mensal, status")
        .eq("status", "Ativo");

      const lucroHoje = calcularLucroOperacionalHoje(receitaHoje, custoVariavelHoje) - taxasFinanceirasHoje;

      const { data: vendasTotais, error: vendasTotaisError } = await supabase
        .from("vendas")
        .select("total");

      if (vendasTotaisError) {
        throw vendasTotaisError;
      }

      const listaVendasTotais = Array.isArray(vendasTotais) ? vendasTotais : [];
      const totalVendas = listaVendasTotais.reduce((soma, venda) => soma + Number(venda.total ?? 0), 0);
      const ticketMedio = listaVendasTotais.length > 0 ? totalVendas / listaVendasTotais.length : 0;

      const { data: produtosBase } = await supabase
        .from("produtos")
        .select("nome, preco_venda, custo_total, preco_minimo, preco_ideal_sugerido")
        .eq("ativo", true);

      const produtosParaAnalise = Array.isArray(produtosBase) ? produtosBase : [];
      const margemMediaProdutos = produtosParaAnalise.length > 0
        ? produtosParaAnalise.reduce((soma, produto) => {
            const precoVenda = Number(produto.preco_venda ?? 0);
            const custoTotal = Number(produto.custo_total ?? 0);
            const margemAtual = precoVenda > 0 ? ((precoVenda - custoTotal) / precoVenda) * 100 : 0;
            return soma + margemAtual;
          }, 0) / produtosParaAnalise.length
        : 0;
      const produtoMaisLucrativo = produtosParaAnalise
        .map((produto) => ({
          nome: String(produto.nome ?? "Produto"),
          margem: Number(produto.preco_venda ?? 0) > 0
            ? ((Number(produto.preco_venda ?? 0) - Number(produto.custo_total ?? 0)) / Number(produto.preco_venda ?? 0)) * 100
            : 0,
        }))
        .sort((a, b) => b.margem - a.margem)[0] ?? null;
      const produtoMaisAbaixoDoMinimo = produtosParaAnalise
        .map((produto) => {
          const precoVenda = Number(produto.preco_venda ?? 0);
          const precoMinimo = Number(produto.preco_minimo ?? 0);
          const precoIdeal = Number(produto.preco_ideal_sugerido ?? 0);
          const precoReferencia = precoIdeal > 0 ? precoIdeal : precoMinimo;
          return {
            nome: String(produto.nome ?? "Produto"),
            diferenca: precoReferencia > 0 ? precoReferencia - precoVenda : 0,
          };
        })
        .filter((produto) => produto.diferenca > 0)
        .sort((a, b) => b.diferenca - a.diferenca)[0] ?? null;

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

      const [{ data: contasReceber }, { data: contasPagar }] = await Promise.all([
        supabase.from("contas_receber").select("valor_aberto, valor_recebido, valor_total"),
        supabase.from("contas_pagar").select("valor_aberto, valor_pago, valor_total"),
      ]);

      const contasAReceber = (contasReceber ?? []).reduce((total, item) => total + Number(item.valor_aberto ?? item.valor_total ?? 0), 0);
      const contasAPagar = (contasPagar ?? []).reduce((total, item) => total + Number(item.valor_aberto ?? item.valor_total ?? 0), 0);
      const recebimentosMes = (contasReceber ?? []).reduce((total, item) => total + Number(item.valor_recebido ?? 0), 0);
      const pagamentosMes = (contasPagar ?? []).reduce((total, item) => total + Number(item.valor_pago ?? 0), 0);
      const estoqueCritico = (await listarItensEstoqueCritico()).length;

      return {
        faturamento_hoje: receitaHoje,
        lucro_hoje: lucroHoje,
        pedidos_hoje: pedidosHoje,
        cookies_hoje: cookiesHoje,
        produtos_vendidos_hoje: produtosVendidosHoje,
        pedidos_ifood_hoje: pedidosIfoodHoje,
        pedidos_balcao_hoje: pedidosBalcaoHoje,
        meta_mensal_percentual: metaMensalPercentual,
        meta_mensal_alvo: metaAlvo,
        meta_mensal_realizado: metaRealizado,
        estoque_critico: estoqueCritico,
        contas_a_receber: contasAReceber,
        contas_a_pagar: contasAPagar,
        caixa_disponivel: calcularCaixaDisponivel(0, recebimentosMes, pagamentosMes),
        ticket_medio: ticketMedio,
        margem_media_produtos: margemMediaProdutos,
        produto_mais_lucrativo: produtoMaisLucrativo,
        produto_mais_abaixo_do_minimo: produtoMaisAbaixoDoMinimo,
      };
    } catch {
      return {
        faturamento_hoje: 0,
        lucro_hoje: 0,
        pedidos_hoje: 0,
        cookies_hoje: 0,
        produtos_vendidos_hoje: 0,
        pedidos_ifood_hoje: 0,
        pedidos_balcao_hoje: 0,
        meta_mensal_percentual: 0,
        meta_mensal_alvo: 0,
        meta_mensal_realizado: 0,
        estoque_critico: 0,
        contas_a_receber: 0,
        contas_a_pagar: 0,
        caixa_disponivel: 0,
        ticket_medio: 0,
        margem_media_produtos: 0,
        produto_mais_lucrativo: null,
        produto_mais_abaixo_do_minimo: null,
      };
    }
  },
};
