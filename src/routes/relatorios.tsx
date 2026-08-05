import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, FileText, PieChart } from "lucide-react";

import { EmptyState } from "@/components/erp/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Candy ERP" },
      { name: "description", content: "Relatórios de vendas, margem, canais e desempenho." },
      { property: "og:title", content: "Relatórios — Candy ERP" },
      { property: "og:description", content: "Relatórios de vendas, margem, canais e desempenho." },
    ],
  }),
  component: RelatoriosPage,
});

const blocos = [
  { title: "Vendas por período", description: "Faturamento diário, semanal e mensal.", icon: BarChart3 },
  { title: "Margem por produto", description: "Custo, preço e lucro por cookie.", icon: PieChart },
  { title: "Exportações", description: "Relatórios em CSV e PDF.", icon: FileText },
];

function RelatoriosPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Relatórios"
        description="Relatórios de vendas, margem, canais e desempenho."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {blocos.map((b) => (
          <Card key={b.title} className="rounded-2xl border-border/70">
            <CardHeader>
              <CardTitle className="text-base">{b.title}</CardTitle>
              <CardDescription>{b.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={b.icon}
                description="Sem dados para gerar este relatório ainda."
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
