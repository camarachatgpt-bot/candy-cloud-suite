import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { Column } from "@/components/erp/data-table";
import { ResourcePage } from "@/components/erp/resource-page";
import { formatCurrency, formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import type { ContaReceber } from "@/lib/erp/types";

export const Route = createFileRoute("/contas-receber")({
  head: () => ({
    meta: [
      { title: "Contas a receber — Candy ERP" },
      { name: "description", content: "Gestão das contas a receber do ERP." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.contasReceber()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: ContasReceberPage,
});

const columns: Column<ContaReceber>[] = [
  { key: "data", header: "Data", cell: (item) => formatDate(item.data) },
  { key: "documento", header: "Documento", cell: (item) => item.documento ?? "—" },
  { key: "origem", header: "Origem", cell: (item) => item.origem },
  { key: "descricao", header: "Descrição", cell: (item) => item.descricao },
  { key: "valor", header: "Valor", cell: (item) => formatCurrency(item.valor) },
  { key: "status", header: "Status", cell: (item) => item.status },
];

function ContasReceberPage() {
  const { data: contas } = useSuspenseQuery(erpQueries.contasReceber());

  return (
    <ResourcePage
      title="Contas a receber"
      description="Acompanhe os recebimentos gerados automaticamente pelas vendas."
      columns={columns}
      rows={contas}
      getRowId={(item) => item.id}
      emptyDescription="Nenhuma conta a receber cadastrada."
    />
  );
}
