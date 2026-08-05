import { queryOptions } from "@tanstack/react-query";

import { erpRepository } from "./repository";

export const erpQueries = {
  produtos: () => queryOptions({ queryKey: ["produtos"], queryFn: erpRepository.produtos }),
  estoque: () => queryOptions({ queryKey: ["estoque"], queryFn: erpRepository.estoque }),
  ingredientes: () => queryOptions({ queryKey: ["ingredientes"], queryFn: erpRepository.ingredientes }),
  receitas: () => queryOptions({ queryKey: ["receitas"], queryFn: erpRepository.receitas }),
  clientes: () => queryOptions({ queryKey: ["clientes"], queryFn: erpRepository.clientes }),
  movimentacoesEstoque: () =>
    queryOptions({
      queryKey: ["movimentacoes-estoque"],
      queryFn: erpRepository.movimentacoesEstoque,
    }),
  fornecedores: () =>
    queryOptions({ queryKey: ["fornecedores"], queryFn: erpRepository.fornecedores }),
  compras: () => queryOptions({ queryKey: ["compras"], queryFn: erpRepository.compras }),
  vendas: () => queryOptions({ queryKey: ["vendas"], queryFn: erpRepository.vendas }),
  categoriasFinanceiras: () =>
    queryOptions({ queryKey: ["categorias-financeiras"], queryFn: erpRepository.categoriasFinanceiras }),
  custosFixos: () => queryOptions({ queryKey: ["custos-fixos"], queryFn: erpRepository.custosFixos }),
  parametrosFinanceiros: () =>
    queryOptions({ queryKey: ["parametros-financeiros"], queryFn: erpRepository.parametrosFinanceiros }),
  contasReceber: () =>
    queryOptions({ queryKey: ["contas-receber"], queryFn: erpRepository.contasReceber }),
  contasPagar: () =>
    queryOptions({ queryKey: ["contas-pagar"], queryFn: erpRepository.contasPagar }),
  lancamentos: () =>
    queryOptions({ queryKey: ["lancamentos"], queryFn: erpRepository.lancamentos }),
  dashboardFinanceiro: () =>
    queryOptions({ queryKey: ["financeiro", "dashboard"], queryFn: erpRepository.dashboardFinanceiro }),
  dashboardAlertas: () =>
    queryOptions({ queryKey: ["dashboard", "alertas"], queryFn: erpRepository.dashboardAlertas }),
  dashboardCustosFixos: () =>
    queryOptions({ queryKey: ["custos-fixos", "dashboard"], queryFn: erpRepository.dashboardCustosFixos }),
  notificacoes: () => queryOptions({ queryKey: ["notificacoes"], queryFn: erpRepository.notificacoes }),
  metas: () => queryOptions({ queryKey: ["metas"], queryFn: erpRepository.metas }),
  resumoDashboard: () =>
    queryOptions({ queryKey: ["dashboard", "resumo"], queryFn: erpRepository.resumoDashboard }),
  dashboardTopProdutos: () =>
    queryOptions({
      queryKey: ["dashboard", "top-produtos"],
      queryFn: erpRepository.dashboardTopProdutos,
    }),
};
