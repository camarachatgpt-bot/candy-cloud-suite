import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import type { Column } from "@/components/erp/data-table";
import { DataTable } from "@/components/erp/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import type { Venda } from "@/lib/erp/types";

export const Route = createFileRoute("/vendas/")({
  head: () => ({
    meta: [
      { title: "Vendas — Candy ERP" },
      { name: "description", content: "Pedidos, canais de venda e acompanhamento de entregas." },
      { property: "og:title", content: "Vendas — Candy ERP" },
      {
        property: "og:description",
        content: "Pedidos, canais de venda e acompanhamento de entregas.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.vendas()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: VendasPage,
});

const columns: Column<Venda>[] = [
  { key: "numero", header: "Pedido", cell: (v) => <span className="font-medium">{v.numero}</span> },
  { key: "cliente", header: "Cliente", cell: (v) => v.cliente_nome ?? "—" },
  {
    key: "plataforma",
    header: "Plataforma",
    cell: (v) => (
      <Badge className="rounded-full border-0 bg-primary-soft text-accent-foreground">
        {v.plataforma}
      </Badge>
    ),
  },
  { key: "data", header: "Data", cell: (v) => formatDate(v.data_venda) },
  { key: "total", header: "Total", cell: (v) => formatCurrency(v.total) },
  { key: "lucro", header: "Lucro", cell: (v) => formatCurrency(v.lucro_estimado) },
];

function VendasPage() {
  const { data: vendas } = useSuspenseQuery(erpQueries.vendas());

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Vendas"
        description="Pedidos, canais de venda e acompanhamento de entregas."
        actions={
          <Button asChild className="rounded-xl shadow-[var(--shadow-glow)]">
            <Link to="/vendas/nova">
              <Plus className="h-4 w-4" />
              Registrar venda
            </Link>
          </Button>
        }
      />

      <Card className="rounded-2xl border-border/70">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={vendas}
            getRowId={(v) => v.id}
            emptyDescription="Nenhuma venda registrada. As vendas aparecerão aqui."
            emptyAction={
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/vendas/nova">
                  <Plus className="h-4 w-4" />
                  Registrar venda
                </Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
