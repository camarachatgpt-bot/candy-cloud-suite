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
import type { ContaReceber } from "@/lib/erp/types";

export const Route = createFileRoute("/contas-receber")({
  head: () => ({
    meta: [
      { title: "Contas a receber — Candy ERP" },
      { name: "description", content: "Gestão das contas a receber do ERP." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.contasReceber()),
  errorComponent: ({ error }) => <ErpRouteError error={error} context={{ module: "contas-receber" }} />,
  component: ContasReceberPage,
});

const columns: Column<ContaReceber>[] = [
  { key: "data", header: "Data", cell: (item) => formatDate(item.data) },
  { key: "documento", header: "Documento", cell: (item) => item.documento ?? "—" },
  { key: "origem", header: "Origem", cell: (item) => item.origem },
  { key: "descricao", header: "Descrição", cell: (item) => item.descricao },
  { key: "valor_total", header: "Valor Total", cell: (item) => formatCurrency(item.valor_total) },
  { key: "valor_recebido", header: "Valor Recebido", cell: (item) => formatCurrency(item.valor_recebido) },
  { key: "valor_aberto", header: "Valor em Aberto", cell: (item) => formatCurrency(item.valor_aberto) },
  { key: "status", header: "Status", cell: (item) => item.status },
  {
    key: "actions",
    header: "Ações",
    cell: () => null,
  },
];

function ContasReceberPage() {
  const queryClient = useQueryClient();
  const { data: contas } = useSuspenseQuery(erpQueries.contasReceber());

  const markAsReceivedMutation = useMutation({
    mutationFn: ({ id, dataRecebimento }: { id: string; dataRecebimento: string }) =>
      erpRepository.marcarContaReceberComoRecebido(id, dataRecebimento),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Conta marcada como recebida.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "marcar",
        context: { module: "contas-receber" },
        fallback: "Não foi possível atualizar a conta.",
      });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => erpRepository.reabrirContaReceber(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Conta reaberta com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "reabrir",
        context: { module: "contas-receber" },
        fallback: "Não foi possível reabrir a conta.",
      });
    },
  });

  const rowsWithActions = contas.map((item) => ({
    ...item,
    onToggleStatus: () => {
      if (item.status === "Pendente") {
        markAsReceivedMutation.mutate({ id: item.id, dataRecebimento: new Date().toISOString().slice(0, 10) });
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
          disabled={markAsReceivedMutation.isPending || reopenMutation.isPending}
        >
          {item.status === "Pendente" || item.status === "Vencido" ? "Receber" : "Reabrir"}
        </Button>
      ),
    },
  ];

  return (
    <ResourcePage
      title="Contas a receber"
      description="Acompanhe os recebimentos gerados automaticamente pelas vendas."
      columns={columnsWithActions}
      rows={rowsWithActions}
      getRowId={(item) => item.id}
      emptyDescription="Nenhuma conta a receber cadastrada."
    />
  );
}
