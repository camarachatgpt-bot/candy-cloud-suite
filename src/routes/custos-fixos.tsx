import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import { handleErpError } from "@/lib/erp/error-handler";
import { ErpRouteError } from "@/lib/erp/route-error";
import type { CustoFixo } from "@/lib/erp/types";

export const Route = createFileRoute("/custos-fixos")({
  head: () => ({
    meta: [
      { title: "Custos Fixos — Candy ERP" },
      { name: "description", content: "Gestão de custos fixos e parâmetros financeiros da operação." },
      { property: "og:title", content: "Custos Fixos — Candy ERP" },
      {
        property: "og:description",
        content: "Gestão de custos fixos e parâmetros financeiros da operação.",
      },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(erpQueries.custosFixos()),
      context.queryClient.ensureQueryData(erpQueries.compras()),
      context.queryClient.ensureQueryData(erpQueries.vendas()),
      context.queryClient.ensureQueryData(erpQueries.parametrosFinanceiros()),
      context.queryClient.ensureQueryData(erpQueries.dashboardCustosFixos()),
    ]),
  errorComponent: ({ error }) => <ErpRouteError error={error} context={{ module: "custos-fixos" }} />,
  component: CustosFixosPage,
});

const columns: Column<CustoFixo>[] = [
  { key: "nome", header: "Descrição", cell: (item) => <span className="font-medium">{item.nome}</span> },
  { key: "categoria", header: "Categoria", cell: (item) => item.categoria ?? "—" },
  { key: "valor_mensal", header: "Valor mensal", cell: (item) => formatCurrency(item.valor_mensal) },
  { key: "data_vencimento", header: "Vencimento", cell: (item) => formatDate(item.data_vencimento ?? "") },
  {
    key: "status",
    header: "Status",
    cell: (item) => (
      <Badge className="rounded-full border-0 bg-primary-soft text-accent-foreground">
        {item.status}
      </Badge>
    ),
  },
];

function CustosFixosPage() {
  const queryClient = useQueryClient();
  const { data: custosFixos } = useSuspenseQuery(erpQueries.custosFixos());
  const { data: parametros } = useSuspenseQuery(erpQueries.parametrosFinanceiros());
  const { data: dashboardCustosFixos } = useSuspenseQuery(erpQueries.dashboardCustosFixos());
  const { data: contasPagar } = useSuspenseQuery(erpQueries.contasPagar());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorMensal, setValorMensal] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [status, setStatus] = useState<"Ativo" | "Inativo">("Ativo");
  const [observacao, setObservacao] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentCostId, setPaymentCostId] = useState<string | null>(null);
  const [paymentCostName, setPaymentCostName] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentObservation, setPaymentObservation] = useState("");
  const [taxaIfood, setTaxaIfood] = useState("");
  const [taxa99food, setTaxa99food] = useState("");
  const [taxaCartao, setTaxaCartao] = useState("");
  const [comissao, setComissao] = useState("");
  const [margemLucroDesejada, setMargemLucroDesejada] = useState("");
  const [percentualPerdas, setPercentualPerdas] = useState("");
  const [metaMensalVendasUnidades, setMetaMensalVendasUnidades] = useState("");

  useEffect(() => {
    if (parametros) {
      setTaxaIfood(String(parametros.taxa_ifood ?? 0));
      setTaxa99food(String(parametros.taxa_99food ?? 0));
      setTaxaCartao(String(parametros.taxa_cartao ?? 0));
      setComissao(String(parametros.comissao ?? 0));
      setMargemLucroDesejada(String(parametros.margem_lucro_desejada ?? 0));
      setPercentualPerdas(String(parametros.percentual_perdas ?? 0));
      setMetaMensalVendasUnidades(String(parametros.meta_mensal_vendas_unidades ?? 0));
    }
  }, [parametros]);

  const resetForm = () => {
    setEditingId(null);
    setNome("");
    setCategoria("");
    setValorMensal("");
    setDataVencimento("");
    setStatus("Ativo");
    setObservacao("");
  };

  const resetPaymentForm = () => {
    setPaymentCostId(null);
    setPaymentCostName("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("");
    setPaymentObservation("");
  };

  const createMutation = useMutation({
    mutationFn: (payload: {
      nome: string;
      categoria: string | null;
      valor_mensal: number;
      data_vencimento: string | null;
      status: "Ativo" | "Inativo";
      observacao: string | null;
    }) => erpRepository.createCustoFixo(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos"] });
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Custo fixo salvo com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "salvar",
        context: { module: "custos-fixos" },
        fallback: "Não foi possível salvar o custo fixo.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: {
      nome: string;
      categoria: string | null;
      valor_mensal: number;
      data_vencimento: string | null;
      status: "Ativo" | "Inativo";
      observacao: string | null;
    } }) => erpRepository.updateCustoFixo(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos"] });
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Custo fixo atualizado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "atualizar",
        context: { module: "custos-fixos" },
        fallback: "Não foi possível atualizar o custo fixo.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => erpRepository.deleteCustoFixo(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos"] });
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Custo fixo removido com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "excluir",
        context: { module: "custos-fixos" },
        fallback: "Não foi possível remover o custo fixo.",
      });
    },
  });

  const parametersMutation = useMutation({
    mutationFn: (payload: {
      taxa_ifood: number;
      taxa_99food: number;
      taxa_cartao: number;
      comissao: number;
      margem_lucro_desejada: number;
      percentual_perdas: number;
      meta_mensal_vendas_unidades: number;
    }) => erpRepository.upsertParametrosFinanceiros(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["parametros-financeiros"] });
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Parâmetros financeiros atualizados.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "salvar",
        context: { module: "custos-fixos", operation: "parametros-financeiros" },
        fallback: "Não foi possível atualizar os parâmetros financeiros.",
      });
    },
  });

  const payCostMutation = useMutation({
    mutationFn: (input: { id: string; dataPagamento: string; formaPagamento: string | null; observacao: string | null }) =>
      erpRepository.pagarCustoFixo(input.id, {
        dataPagamento: input.dataPagamento,
        formaPagamento: input.formaPagamento,
        observacao: input.observacao,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      await queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      toast.success("Pagamento registrado com sucesso.");
      setPaymentModalOpen(false);
      setPaymentCostId(null);
      setPaymentCostName("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("");
      setPaymentObservation("");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "processar",
        context: { module: "custos-fixos", operation: "pagamento" },
        fallback: "Não foi possível registrar o pagamento.",
      });
    },
  });

  const handleDelete = (item: CustoFixo) => {
    const confirmed = window.confirm(`Deseja realmente remover ${item.nome}?`);

    if (!confirmed) {
      return;
    }

    deleteMutation.mutate(item.id);
  };

  const openEditor = (item?: CustoFixo) => {
    if (item) {
      setEditingId(item.id);
      setNome(item.nome);
      setCategoria(item.categoria ?? "");
      setValorMensal(String(item.valor_mensal));
      setDataVencimento(item.data_vencimento ?? "");
      setStatus(item.status);
      setObservacao(item.observacao ?? "");
    } else {
      resetForm();
    }

    setOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      valor_mensal: Number(valorMensal),
      data_vencimento: dataVencimento || null,
      status,
      observacao: observacao.trim() || null,
    };

    if (!payload.nome || Number.isNaN(payload.valor_mensal)) {
      toast.error("Informe a descrição e o valor mensal do custo fixo.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const handleSaveParameters = () => {
    parametersMutation.mutate({
      taxa_ifood: Number(taxaIfood),
      taxa_99food: Number(taxa99food),
      taxa_cartao: Number(taxaCartao),
      comissao: Number(comissao),
      margem_lucro_desejada: Number(margemLucroDesejada),
      percentual_perdas: Number(percentualPerdas),
      meta_mensal_vendas_unidades: Number(metaMensalVendasUnidades),
    });
  };

  const openPaymentModal = (item: CustoFixo) => {
    setPaymentCostId(item.id);
    setPaymentCostName(item.nome);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("");
    setPaymentObservation("");
    setPaymentModalOpen(true);
  };

  const handlePayCost = () => {
    if (!paymentCostId) {
      toast.error("Selecione um custo fixo para pagamento.");
      return;
    }

    payCostMutation.mutate({
      id: paymentCostId,
      dataPagamento: paymentDate,
      formaPagamento: paymentMethod || null,
      observacao: paymentObservation.trim() || null,
    });
  };

  const cards = [
    {
      title: "Compras de Mercado / Estoque (mês)",
      value: formatCurrency(dashboardCustosFixos.compras_mes),
      description: "Total das compras registradas no mês atual.",
    },
    {
      title: "Custos Fixos (mês)",
      value: formatCurrency(dashboardCustosFixos.custos_fixos_mes),
      description: "Somatório dos custos fixos ativos do mês.",
    },
    {
      title: "Produtos Vendidos (mês)",
      value: `${dashboardCustosFixos.produtos_vendidos_mes.toLocaleString("pt-BR")}`,
      description: "Quantidade total de produtos vendidos no mês.",
    },
    {
      title: "% dos Custos Fixos sobre o faturamento",
      value: `${dashboardCustosFixos.percentual_custos_fixos_sobre_faturamento.toFixed(1)}%`,
      description: "Participação dos custos fixos no faturamento mensal.",
    },
    {
      title: "Rateio dos Custos Fixos por produto vendido",
      value: formatCurrency(dashboardCustosFixos.rateio_custos_fixos_por_produto),
      description: "Custo fixo médio por unidade vendida do mês.",
    },
    {
      title: "Faturamento do mês",
      value: formatCurrency(dashboardCustosFixos.faturamento_mes),
      description: "Receita consolidada das vendas do mês.",
    },
    {
      title: "Lucro bruto",
      value: formatCurrency(dashboardCustosFixos.lucro_bruto),
      description: "Diferença entre faturamento e compras do mês.",
    },
    {
      title: "Lucro líquido",
      value: formatCurrency(dashboardCustosFixos.lucro_liquido),
      description: "Resultado após compras e custos fixos mensais.",
    },
    {
      title: "Margem líquida (%)",
      value: `${dashboardCustosFixos.margem_liquida.toFixed(1)}%`,
      description: "Percentual do faturamento que sobra após custos fixos.",
    },
    {
      title: "Ponto de equilíbrio",
      value: formatCurrency(dashboardCustosFixos.ponto_equilibrio),
      description: "Faturamento mínimo para cobrir os custos fixos.",
    },
  ];

  const custosFixosAtivos = custosFixos.filter((item) => item.status === "Ativo");
  const custosFixosJaPagos = new Set(
    contasPagar
      .filter((item) => item.documento?.startsWith("custo-fixo:") && (item.status === "Pago" || item.status === "Parcial"))
      .map((item) => item.documento?.replace("custo-fixo:", "") ?? ""),
  );
  const totalCustosFixosMensais = custosFixosAtivos.reduce((total, item) => total + item.valor_mensal, 0);
  const proximosVencimentos = custosFixosAtivos
    .filter((item) => item.data_vencimento && !custosFixosJaPagos.has(item.id))
    .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""))
    .slice(0, 5);
  const ultimosPagamentos = contasPagar
    .filter((item) => item.status === "Pago" || item.status === "Parcial")
    .sort((a, b) => (b.data_pagamento ?? b.data ?? "").localeCompare(a.data_pagamento ?? a.data ?? ""))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/60 bg-background/70 p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Dashboard do mês</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores automáticos com base em compras, vendas e custos fixos.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.title} className="border-border/60 bg-background/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Quanto custa manter a Candy Colors aberta</CardTitle>
            <CardDescription>Resumo dos custos fixos ativos e o total mensal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between rounded-2xl bg-muted/40 p-4">
              <div>
                <p className="text-sm text-muted-foreground">Total mensal</p>
                <p className="text-2xl font-semibold">{formatCurrency(totalCustosFixosMensais)}</p>
              </div>
              <Badge className="rounded-full border-0 bg-primary-soft text-accent-foreground">
                {custosFixosAtivos.length} ativos
              </Badge>
            </div>
            <div className="space-y-2">
              {custosFixosAtivos.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
                  <span>{item.nome}</span>
                  <span className="font-medium">{formatCurrency(item.valor_mensal)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Próximos vencimentos</CardTitle>
            <CardDescription>Custos fixos com vencimento mais próximo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {proximosVencimentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum vencimento cadastrado.</p>
            ) : (
              proximosVencimentos.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.valor_mensal)}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => openPaymentModal(item)}
                      disabled={payCostMutation.isPending}
                    >
                      <CreditCard className="mr-1 h-4 w-4" />
                      Pagar
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.data_vencimento ?? "")}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Últimos pagamentos</CardTitle>
          <CardDescription>Pagamentos registrados recentemente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ultimosPagamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
          ) : (
            ultimosPagamentos.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{item.descricao}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.data_pagamento ?? item.data ?? "")}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(item.valor_total)}</p>
                  <p className="text-xs text-muted-foreground">{item.status}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ResourcePage
        title="Custos Fixos"
        description="Cadastre custos recorrentes que impactam a precificação dos produtos."
        columns={[
          ...columns,
          {
            key: "actions",
            header: "Ações",
            cell: (item: CustoFixo) => (
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => openEditor(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(item)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]}
        rows={custosFixos}
        getRowId={(item) => item.id}
        actionLabel="Novo custo fixo"
        onAction={() => openEditor()}
        emptyDescription="Nenhum custo fixo cadastrado. Adicione o primeiro para calcular a precificação.
"
      />

      <div className="rounded-3xl border border-border/60 bg-background/70 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Parâmetros financeiros</h2>
            <p className="text-sm text-muted-foreground">
              Ajuste as taxas e margens que serão usadas no cálculo de preço mínimo e ideal.
            </p>
          </div>
          <Button type="button" onClick={handleSaveParameters} disabled={parametersMutation.isPending}>
            Salvar parâmetros
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            id="taxaIfood"
            label="Taxa iFood (%)"
            type="number"
            value={taxaIfood}
            onChange={setTaxaIfood}
            placeholder="0"
          />
          <FormField
            id="taxa99food"
            label="Taxa 99Food (%)"
            type="number"
            value={taxa99food}
            onChange={setTaxa99food}
            placeholder="0"
          />
          <FormField
            id="taxaCartao"
            label="Taxa cartão (%)"
            type="number"
            value={taxaCartao}
            onChange={setTaxaCartao}
            placeholder="0"
          />
          <FormField
            id="comissao"
            label="Comissão (%)"
            type="number"
            value={comissao}
            onChange={setComissao}
            placeholder="0"
          />
          <FormField
            id="margemLucroDesejada"
            label="Margem desejada (%)"
            type="number"
            value={margemLucroDesejada}
            onChange={setMargemLucroDesejada}
            placeholder="0"
          />
          <FormField
            id="percentualPerdas"
            label="Perdas (%)"
            type="number"
            value={percentualPerdas}
            onChange={setPercentualPerdas}
            placeholder="0"
          />
          <FormField
            id="metaMensalVendasUnidades"
            label="Meta mensal de vendas (unidades)"
            type="number"
            value={metaMensalVendasUnidades}
            onChange={setMetaMensalVendasUnidades}
            placeholder="0"
          />
        </div>
      </div>

      <FormModal
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            resetForm();
          }
        }}
        title={editingId ? "Editar custo fixo" : "Novo custo fixo"}
        description="Cadastre um custo recorrente para compor a precificação dos produtos."
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      >
        <FormField id="nomeCusto" label="Descrição" value={nome} onChange={setNome} placeholder="Aluguel, salário, internet" />
        <FormField id="categoriaCusto" label="Categoria" value={categoria} onChange={setCategoria} placeholder="Operação" />
        <FormField
          id="valorMensal"
          label="Valor mensal"
          type="number"
          value={valorMensal}
          onChange={setValorMensal}
          placeholder="0,00"
        />
        <FormField
          id="dataVencimento"
          label="Data de vencimento"
          type="date"
          value={dataVencimento}
          onChange={setDataVencimento}
          placeholder=""
        />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="statusCusto">
            Status
          </label>
          <Select value={status} onValueChange={(value) => setStatus(value as "Ativo" | "Inativo")}>
            <SelectTrigger id="statusCusto" className="rounded-xl">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <FormField
          id="observacaoCusto"
          label="Observação"
          value={observacao}
          onChange={setObservacao}
          placeholder="Detalhes do custo"
          textarea
        />
      </FormModal>

      <FormModal
        open={paymentModalOpen}
        onOpenChange={(isOpen) => {
          setPaymentModalOpen(isOpen);
          if (!isOpen) {
            resetPaymentForm();
          }
        }}
        title="Registrar pagamento"
        description={`Registrar pagamento para ${paymentCostName || "o custo fixo"}.`}
        onSubmit={handlePayCost}
        submitLabel="Confirmar pagamento"
        submitting={payCostMutation.isPending}
      >
        <FormField
          id="paymentDate"
          label="Data"
          type="date"
          value={paymentDate}
          onChange={setPaymentDate}
          placeholder=""
        />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="paymentMethod">
            Forma de pagamento
          </label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger id="paymentMethod" className="rounded-xl">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              <SelectItem value="Pix">Pix</SelectItem>
              <SelectItem value="Cartão">Cartão</SelectItem>
              <SelectItem value="Transferência">Transferência</SelectItem>
              <SelectItem value="Boleto">Boleto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <FormField
          id="paymentObservation"
          label="Observação"
          value={paymentObservation}
          onChange={setPaymentObservation}
          placeholder="Detalhes do pagamento"
          textarea
        />
      </FormModal>
    </div>
  );
}
