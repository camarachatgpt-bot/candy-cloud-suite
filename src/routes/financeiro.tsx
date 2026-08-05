import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CreditCard, Receipt, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { StatCard } from "@/components/erp/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import { handleErpError } from "@/lib/erp/error-handler";
import { ErpRouteError } from "@/lib/erp/route-error";
import type { ContaPagar, ContaReceber } from "@/lib/erp/types";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Candy ERP" },
      { name: "description", content: "Contas a pagar, a receber e fluxo de caixa da confeitaria." },
      { property: "og:title", content: "Financeiro — Candy ERP" },
      {
        property: "og:description",
        content: "Contas a pagar, a receber e fluxo de caixa da confeitaria.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.lancamentos()),
  errorComponent: ({ error }) => <ErpRouteError error={error} context={{ module: "financeiro" }} />,
  component: FinanceiroPage,
});

type EntradaFinanceira = {
  id: string;
  tipo: "Pagar" | "Receber";
  data: string;
  dataVencimento: string | null;
  documento: string | null;
  origem: string;
  descricao: string;
  valor: number;
  valorTotal: number;
  valorPago: number;
  valorAberto: number;
  status: string;
  categoria: string | null;
};

const columns: Column<EntradaFinanceira>[] = [
  {
    key: "tipo",
    header: "Tipo",
    cell: (item) => (
      <Badge className="rounded-full border-0 bg-primary-soft text-accent-foreground">
        {item.tipo}
      </Badge>
    ),
  },
  { key: "descricao", header: "Descrição", cell: (item) => item.descricao },
  { key: "documento", header: "Documento", cell: (item) => item.documento ?? "—" },
  { key: "origem", header: "Origem", cell: (item) => item.origem },
  { key: "categoria", header: "Categoria", cell: (item) => item.categoria ?? "—" },
  { key: "data", header: "Data", cell: (item) => formatDate(item.data) },
  { key: "dataVencimento", header: "Data de vencimento", cell: (item) => formatDate(item.dataVencimento ?? "") },
  { key: "valorTotal", header: "Valor Total", cell: (item) => formatCurrency(item.valorTotal) },
  { key: "valorPago", header: "Valor Pago", cell: (item) => formatCurrency(item.valorPago) },
  { key: "valorAberto", header: "Valor em Aberto", cell: (item) => formatCurrency(item.valorAberto) },
  { key: "status", header: "Status", cell: (item) => item.status },
  {
    key: "actions",
    header: "Ações",
    cell: () => null,
  },
];

function FinanceiroPage() {
  const queryClient = useQueryClient();
  const { data: dashboard } = useSuspenseQuery(erpQueries.dashboardFinanceiro());
  const { data: contasPagar } = useSuspenseQuery(erpQueries.contasPagar());
  const { data: contasReceber } = useSuspenseQuery(erpQueries.contasReceber());
  const [filtro, setFiltro] = useState("todos");
  const [modalTipo, setModalTipo] = useState<"despesa" | "receita" | null>(null);
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fornecedorOuCliente, setFornecedorOuCliente] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");
  const [status, setStatus] = useState("Pendente");
  const [partialModal, setPartialModal] = useState<{
    id: string;
    tipo: "Pagar" | "Receber";
    descricao: string;
    valorTotal: number;
    valorPago: number;
    valorAberto: number;
    valorRestante: number;
    valor: string;
    data: string;
    forma: string;
    observacao: string;
  } | null>(null);

  const markAsPaidMutation = useMutation({
    mutationFn: ({ id, dataPagamento }: { id: string; dataPagamento: string }) =>
      erpRepository.marcarContaPagarComoPago(id, dataPagamento),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Conta marcada como paga.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "marcar",
        context: { module: "financeiro", operation: "conta-pagar" },
        fallback: "Não foi possível atualizar a conta.",
      });
    },
  });

  const reopenPagarMutation = useMutation({
    mutationFn: (id: string) => erpRepository.reabrirContaPagar(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Conta reaberta com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "reabrir",
        context: { module: "financeiro", operation: "conta-pagar" },
        fallback: "Não foi possível reabrir a conta.",
      });
    },
  });

  const markAsReceivedMutation = useMutation({
    mutationFn: ({ id, dataRecebimento }: { id: string; dataRecebimento: string }) =>
      erpRepository.marcarContaReceberComoRecebido(id, dataRecebimento),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Conta marcada como recebida.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "marcar",
        context: { module: "financeiro", operation: "conta-receber" },
        fallback: "Não foi possível atualizar a conta.",
      });
    },
  });

  const reopenReceberMutation = useMutation({
    mutationFn: (id: string) => erpRepository.reabrirContaReceber(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Conta reaberta com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "reabrir",
        context: { module: "financeiro", operation: "conta-receber" },
        fallback: "Não foi possível reabrir a conta.",
      });
    },
  });

  const createDespesaMutation = useMutation({
    mutationFn: (payload: {
      empresa_id: string | null;
      descricao: string;
      categoria_id: string | null;
      fornecedor: string | null;
      valor: number;
      data: string;
      observacao: string | null;
      status: "Pendente" | "Pago";
    }) => erpRepository.createDespesaManual(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Despesa cadastrada com sucesso.");
      setModalTipo(null);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "salvar",
        context: { module: "financeiro", operation: "despesa" },
        fallback: "Não foi possível salvar a despesa.",
      });
    },
  });

  const partialPaymentMutation = useMutation({
    mutationFn: ({ id, dataPagamento, valorPagamento, formaPagamento, observacao }: { id: string; dataPagamento: string; valorPagamento: number; formaPagamento: string | null; observacao: string | null }) =>
      erpRepository.marcarContaPagarComoPago(id, dataPagamento, valorPagamento, formaPagamento, observacao),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Pagamento parcial registrado.");
      setPartialModal(null);
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "processar",
        context: { module: "financeiro", operation: "pagamento-parcial" },
        fallback: "Não foi possível registrar o pagamento parcial.",
      });
    },
  });

  const partialReceiptMutation = useMutation({
    mutationFn: ({ id, dataRecebimento, valorRecebimento, formaRecebimento, observacao }: { id: string; dataRecebimento: string; valorRecebimento: number; formaRecebimento: string | null; observacao: string | null }) =>
      erpRepository.marcarContaReceberComoRecebido(id, dataRecebimento, valorRecebimento, formaRecebimento, observacao),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Recebimento parcial registrado.");
      setPartialModal(null);
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "processar",
        context: { module: "financeiro", operation: "recebimento-parcial" },
        fallback: "Não foi possível registrar o recebimento parcial.",
      });
    },
  });

  const createReceitaMutation = useMutation({
    mutationFn: (payload: {
      empresa_id: string | null;
      descricao: string;
      categoria_id: string | null;
      cliente: string | null;
      valor: number;
      data: string;
      observacao: string | null;
      status: "Pendente" | "Recebido";
    }) => erpRepository.createReceitaManual(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Receita cadastrada com sucesso.");
      setModalTipo(null);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "salvar",
        context: { module: "financeiro", operation: "receita" },
        fallback: "Não foi possível salvar a receita.",
      });
    },
  });

  const resetForm = () => {
    setDescricao("");
    setCategoria("");
    setFornecedorOuCliente("");
    setValor("");
    setData(new Date().toISOString().slice(0, 10));
    setObservacao("");
    setStatus("Pendente");
  };

  const lancamentos = useMemo(() => {
    const itens = [
      ...contasPagar.map((item: ContaPagar) => ({
        id: item.id,
        tipo: "Pagar" as const,
        data: item.data,
        dataVencimento: item.data_vencimento,
        documento: item.documento,
        origem: item.origem,
        descricao: item.descricao,
        valor: item.valor,
        valorTotal: item.valor_total,
        valorPago: item.valor_pago,
        valorAberto: item.valor_aberto,
        status: item.status,
        categoria: item.categoria,
      })),
      ...contasReceber.map((item: ContaReceber) => ({
        id: item.id,
        tipo: "Receber" as const,
        data: item.data,
        dataVencimento: item.data_vencimento,
        origem: item.origem,
        documento: item.documento,
        descricao: item.descricao,
        valor: item.valor,
        valorTotal: item.valor_total,
        valorPago: item.valor_recebido,
        valorAberto: item.valor_aberto,
        status: item.status,
        categoria: item.categoria,
      })),
    ];

    const filtered = itens.filter((item) => {
      if (filtro === "todos") return true;
      if (filtro === "pendentes") return item.status === "Pendente";
      if (filtro === "pagos") return item.tipo === "Pagar" && item.status === "Pago";
      if (filtro === "recebidos") return item.tipo === "Receber" && item.status === "Recebido";
      if (filtro === "mes") {
        const current = new Date();
        const itemDate = new Date(item.data);
        return itemDate.getMonth() === current.getMonth() && itemDate.getFullYear() === current.getFullYear();
      }
      return true;
    });

    return filtered.sort((left, right) => new Date(right.data).getTime() - new Date(left.data).getTime());
  }, [contasPagar, contasReceber, filtro]);

  const handleSubmitManual = () => {
    if (!descricao.trim() || !valor) {
      toast.error("Descrição e valor são obrigatórios.");
      return;
    }

    const numericValue = Number(valor);

    if (Number.isNaN(numericValue) || numericValue <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    if (modalTipo === "despesa") {
      createDespesaMutation.mutate({
        empresa_id: null,
        descricao: descricao.trim(),
        categoria_id: categoria.trim() ? categoria : null,
        fornecedor: fornecedorOuCliente.trim() || null,
        valor: numericValue,
        data,
        observacao: observacao.trim() || null,
        status: status as "Pendente" | "Pago",
      });
      return;
    }

    createReceitaMutation.mutate({
      empresa_id: null,
      descricao: descricao.trim(),
      categoria_id: categoria.trim() ? categoria : null,
      cliente: fornecedorOuCliente.trim() || null,
      valor: numericValue,
      data,
      observacao: observacao.trim() || null,
      status: status as "Pendente" | "Recebido",
    });
  };

  const handleFullPayment = (item: EntradaFinanceira) => {
    const today = new Date().toISOString().slice(0, 10);

    if (item.tipo === "Pagar") {
      markAsPaidMutation.mutate({ id: item.id, dataPagamento: today });
      return;
    }

    markAsReceivedMutation.mutate({ id: item.id, dataRecebimento: today });
  };

  const handleReopen = (item: EntradaFinanceira) => {
    if (item.tipo === "Pagar") {
      reopenPagarMutation.mutate(item.id);
      return;
    }

    reopenReceberMutation.mutate(item.id);
  };

  const openPartialModal = (item: EntradaFinanceira) => {
    setPartialModal({
      id: item.id,
      tipo: item.tipo,
      descricao: item.descricao,
      valorTotal: item.valorTotal,
      valorPago: item.valorPago,
      valorAberto: item.valorAberto,
      valorRestante: item.valorAberto,
      valor: String(item.valorAberto),
      data: new Date().toISOString().slice(0, 10),
      forma: "",
      observacao: "",
    });
  };

  const handleSubmitPartial = () => {
    if (!partialModal) {
      return;
    }

    const numericValue = Number(partialModal.valor);

    if (Number.isNaN(numericValue) || numericValue <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    if (numericValue > partialModal.valorRestante) {
      toast.error("O valor parcial não pode ser maior que o restante da conta.");
      return;
    }

    if (partialModal.tipo === "Pagar") {
      partialPaymentMutation.mutate({
        id: partialModal.id,
        dataPagamento: partialModal.data,
        valorPagamento: numericValue,
        formaPagamento: partialModal.forma || null,
        observacao: partialModal.observacao.trim() || null,
      });
      return;
    }

    partialReceiptMutation.mutate({
      id: partialModal.id,
      dataRecebimento: partialModal.data,
      valorRecebimento: numericValue,
      formaRecebimento: partialModal.forma || null,
      observacao: partialModal.observacao.trim() || null,
    });
  };

  const rowsWithActions = lancamentos.map((item) => ({
    ...item,
    onFullPayment: () => handleFullPayment(item),
    onReopen: () => handleReopen(item),
    onOpenPartial: () => openPartialModal(item),
  }));

  const columnsWithActions: Column<(typeof rowsWithActions)[number]>[] = [
    ...columns,
    {
      key: "actions",
      header: "Ações",
      cell: (item) => {
        const isPending = item.status === "Pendente" || item.status === "Vencido";
        const isPartial = item.status === "Parcial";
        const isSettled = item.status === "Pago" || item.status === "Recebido";

        if (isSettled) {
          return (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl px-2"
              onClick={() => item.onReopen()}
              disabled={reopenPagarMutation.isPending || reopenReceberMutation.isPending}
            >
              Reabrir
            </Button>
          );
        }

        return (
          <div className="flex flex-wrap gap-2">
            {item.valorAberto > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl px-2"
                onClick={() => item.onOpenPartial()}
                disabled={partialPaymentMutation.isPending || partialReceiptMutation.isPending}
              >
                {item.tipo === "Pagar"
                  ? isPending
                    ? "Pagar Parcial"
                    : "Registrar novo pagamento"
                  : isPending
                    ? "Registrar recebimento parcial"
                    : "Registrar novo recebimento"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl px-2"
              onClick={() => item.onFullPayment()}
              disabled={markAsPaidMutation.isPending || markAsReceivedMutation.isPending}
            >
              {item.tipo === "Pagar"
                ? isPartial
                  ? "Quitar saldo"
                  : "Quitar"
                : isPartial
                  ? "Receber saldo"
                  : "Receber"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <ResourcePage
        title="Financeiro"
        description="Contas a pagar, a receber e fluxo de caixa da confeitaria."
        columns={columnsWithActions}
        rows={rowsWithActions}
        getRowId={(item) => item.id}
        emptyDescription="Nenhuma movimentação financeira cadastrada ainda."
        actionLabel={modalTipo ? undefined : "Nova despesa"}
        onAction={() => setModalTipo("despesa")}
        toolbar={
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setModalTipo("despesa")}>Nova Despesa</Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setModalTipo("receita")}>Nova Receita</Button>
            </div>
            <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3 md:grid-cols-[1fr_220px]">
              <Input
                value={filtro}
                readOnly
                className="rounded-xl"
                placeholder="Filtro"
              />
              <Select value={filtro} onValueChange={setFiltro}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendentes">Pendentes</SelectItem>
                  <SelectItem value="pagos">Pagos</SelectItem>
                  <SelectItem value="recebidos">Recebidos</SelectItem>
                  <SelectItem value="mes">Mês Atual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Receita do mês"
                value={formatCurrency(dashboard.receitas_do_mes)}
                icon={Banknote}
                hint="Resumo das contas a receber"
              />
              <StatCard
                label="Despesas do mês"
                value={formatCurrency(dashboard.despesas_do_mes)}
                icon={CreditCard}
                hint="Resumo das contas a pagar"
              />
              <StatCard
                label="Saldo do mês"
                value={formatCurrency(dashboard.saldo)}
                icon={Wallet}
                hint="Resultado líquido do período"
              />
              <StatCard
                label="Contas a pagar"
                value={dashboard.contas_a_pagar}
                icon={Receipt}
                hint={`${contasPagar.length} registros ativos`}
              />
              <StatCard
                label="Contas a receber"
                value={dashboard.contas_a_receber}
                icon={Banknote}
                hint={`${contasReceber.length} registros ativos`}
              />
            </div>
          </div>
        }
      />

      <FormModal
        open={Boolean(modalTipo)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setModalTipo(null);
            resetForm();
          }
        }}
        title={modalTipo === "despesa" ? "Nova despesa" : "Nova receita"}
        description={modalTipo === "despesa" ? "Cadastre uma despesa manual diretamente em contas a pagar." : "Cadastre uma receita manual diretamente em contas a receber."}
        onSubmit={handleSubmitManual}
        submitting={createDespesaMutation.isPending || createReceitaMutation.isPending}
      >
        <FormField id="descricao" label="Descrição" value={descricao} onChange={setDescricao} />
        <FormField id="categoria" label="Categoria" value={categoria} onChange={setCategoria} />
        <FormField id="fornecedorCliente" label={modalTipo === "despesa" ? "Fornecedor" : "Cliente"} value={fornecedorOuCliente} onChange={setFornecedorOuCliente} placeholder={modalTipo === "despesa" ? "Opcional" : "Opcional"} />
        <FormField id="valor" label="Valor" type="number" value={valor} onChange={setValor} />
        <FormField id="data" label="Data" type="date" value={data} onChange={setData} />
        <FormField id="observacao" label="Observação" value={observacao} onChange={setObservacao} textarea />
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value={modalTipo === "despesa" ? "Pago" : "Recebido"}>{modalTipo === "despesa" ? "Pago" : "Recebido"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FormModal>

      <FormModal
        open={Boolean(partialModal)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPartialModal(null);
          }
        }}
        title={partialModal?.tipo === "Pagar" ? "Registrar pagamento parcial" : "Registrar recebimento parcial"}
        description={partialModal ? `Atualize parcialmente ${partialModal.descricao}.` : undefined}
        onSubmit={handleSubmitPartial}
        submitting={partialPaymentMutation.isPending || partialReceiptMutation.isPending}
        submitLabel="Salvar parcial"
      >
        {partialModal ? (
          <>
            <div className="space-y-2 rounded-xl bg-muted/20 p-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>Valor Total</span>
                <span className="font-medium text-foreground">{formatCurrency(partialModal.valorTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Valor Pago</span>
                <span className="font-medium text-foreground">{formatCurrency(partialModal.valorPago)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Valor em Aberto</span>
                <span className="font-medium text-foreground">{formatCurrency(partialModal.valorAberto)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                <span>Restante</span>
                <span className="font-medium text-foreground">{formatCurrency(partialModal.valorRestante)}</span>
              </div>
            </div>
            <FormField id="valor-parcial" label="Valor parcial" type="number" value={partialModal.valor} onChange={(value) => setPartialModal((current) => current ? { ...current, valor: value } : current)} />
            <FormField id="data-parcial" label="Data" type="date" value={partialModal.data} onChange={(value) => setPartialModal((current) => current ? { ...current, data: value } : current)} />
            <div className="space-y-2">
              <label className="text-sm font-medium">Forma</label>
              <Select value={partialModal.forma} onValueChange={(value) => setPartialModal((current) => current ? { ...current, forma: value } : current)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormField id="observacao-parcial" label="Observação" value={partialModal.observacao} onChange={(value) => setPartialModal((current) => current ? { ...current, observacao: value } : current)} textarea />
          </>
        ) : null}
      </FormModal>
    </>
  );
}
