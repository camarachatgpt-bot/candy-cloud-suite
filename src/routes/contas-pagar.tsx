import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { Column } from "@/components/erp/data-table";
import { ResourcePage } from "@/components/erp/resource-page";
import { formatCurrency, formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import type { ContaPagar } from "@/lib/erp/types";

export const Route = createFileRoute("/contas-pagar")({
  head: () => ({
    meta: [
      { title: "Contas a pagar — Candy ERP" },
      { name: "description", content: "Gestão das contas a pagar do ERP." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.contasPagar()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: ContasPagarPage,
});

const columns: Column<ContaPagar>[] = [
  { key: "data", header: "Data", cell: (item) => formatDate(item.data) },
  { key: "documento", header: "Documento", cell: (item) => item.documento ?? "—" },
  { key: "origem", header: "Origem", cell: (item) => item.origem },
  { key: "descricao", header: "Descrição", cell: (item) => item.descricao },
  { key: "valor", header: "Valor", cell: (item) => formatCurrency(item.valor) },
  { key: "status", header: "Status", cell: (item) => item.status },
];

function ContasPagarPage() {
  const { data: contas } = useSuspenseQuery(erpQueries.contasPagar());

  return (
    <ResourcePage
      title="Contas a pagar"
      description="Acompanhe os pagamentos gerados automaticamente pelas compras."
      columns={columns}
      rows={contas}
      getRowId={(item) => item.id}
      emptyDescription="Nenhuma conta a pagar cadastrada."
    />
  );
}
