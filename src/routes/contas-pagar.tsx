import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { ResourcePage } from "@/components/erp/resource-page";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import { handleErpError } from "@/lib/erp/error-handler";
import { ErpRouteError } from "@/lib/erp/route-error";
import type { ContaPagar } from "@/lib/erp/types";

export const Route = createFileRoute("/contas-pagar")({
  head: () => ({
    meta: [
      { title: "Contas a pagar — Candy ERP" },
      { name: "description", content: "Gestão das contas a pagar do ERP." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.contasPagar()),
  errorComponent: ({ error }) => <ErpRouteError error={error} context={{ module: "contas-pagar" }} />,
  component: ContasPagarPage,
});

const columns: Column<ContaPagar>[] = [
  { key: "data", header: "Data", cell: (item) => formatDate(item.data) },
  { key: "documento", header: "Documento", cell: (item) => item.documento ?? "—" },
  { key: "origem", header: "Origem", cell: (item) => item.origem },
  { key: "descricao", header: "Descrição", cell: (item) => item.descricao },
  { key: "valor_total", header: "Valor Total", cell: (item) => formatCurrency(item.valor_total) },
  { key: "valor_pago", header: "Valor Pago", cell: (item) => formatCurrency(item.valor_pago) },
  { key: "valor_aberto", header: "Valor em Aberto", cell: (item) => formatCurrency(item.valor_aberto) },
  { key: "status", header: "Status", cell: (item) => item.status },
  {
    key: "actions",
    header: "Ações",
    cell: () => null,
  },
];

function ContasPagarPage() {
  const queryClient = useQueryClient();
  const { data: contas } = useSuspenseQuery(erpQueries.contasPagar());

  const markAsPaidMutation = useMutation({
    mutationFn: ({ id, dataPagamento }: { id: string; dataPagamento: string }) =>
      erpRepository.marcarContaPagarComoPago(id, dataPagamento),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Conta marcada como paga.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "marcar",
        context: { module: "contas-pagar" },
        fallback: "Não foi possível atualizar a conta.",
      });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => erpRepository.reabrirContaPagar(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Conta reaberta com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "reabrir",
        context: { module: "contas-pagar" },
        fallback: "Não foi possível reabrir a conta.",
      });
    },
  });

  const rowsWithActions = contas.map((item) => ({
    ...item,
    onToggleStatus: () => {
      if (item.status === "Pendente") {
        markAsPaidMutation.mutate({ id: item.id, dataPagamento: new Date().toISOString().slice(0, 10) });
        return;
      }

      reopenMutation.mutate(item.id);
    },
  }));

  const columnsWithActions: Column<(typeof rowsWithActions)[number]>[] = [
    ...columns,
    {
      key: "actions",
      header: "Ações",
      cell: (item) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl px-2"
          onClick={() => item.onToggleStatus()}
          disabled={markAsPaidMutation.isPending || reopenMutation.isPending}
        >
          {item.status === "Pendente" || item.status === "Vencido" ? "Quitar" : "Reabrir"}
        </Button>
      ),
    },
  ];

  return (
    <ResourcePage
      title="Contas a pagar"
      description="Acompanhe os pagamentos gerados automaticamente pelas compras."
      columns={columnsWithActions}
      rows={rowsWithActions}
      getRowId={(item) => item.id}
      emptyDescription="Nenhuma conta a pagar cadastrada."
    />
  );
}
