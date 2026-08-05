import { queryOptions } from "@tanstack/react-query";

import { erpRepository } from "./repository";

export const erpQueries = {
  produtos: () => queryOptions({ queryKey: ["produtos"], queryFn: erpRepository.produtos }),
  estoque: () => queryOptions({ queryKey: ["estoque"], queryFn: erpRepository.estoque }),
  clientes: () => queryOptions({ queryKey: ["clientes"], queryFn: erpRepository.clientes }),
  fornecedores: () =>
    queryOptions({ queryKey: ["fornecedores"], queryFn: erpRepository.fornecedores }),
  vendas: () => queryOptions({ queryKey: ["vendas"], queryFn: erpRepository.vendas }),
  lancamentos: () =>
    queryOptions({ queryKey: ["lancamentos"], queryFn: erpRepository.lancamentos }),
  metas: () => queryOptions({ queryKey: ["metas"], queryFn: erpRepository.metas }),
  resumoDashboard: () =>
    queryOptions({ queryKey: ["dashboard", "resumo"], queryFn: erpRepository.resumoDashboard }),
  dashboardTopProdutos: () =>
    queryOptions({
      queryKey: ["dashboard", "top-produtos"],
      queryFn: erpRepository.dashboardTopProdutos,
    }),
};
