import { createFileRoute } from "@tanstack/react-router";
import { Brain, Lightbulb, TrendingUp } from "lucide-react";

import { EmptyState } from "@/components/erp/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/inteligencia")({
  head: () => ({
    meta: [
      { title: "Inteligência — Candy ERP" },
      { name: "description", content: "Insights, previsões e recomendações para a confeitaria." },
      { property: "og:title", content: "Inteligência — Candy ERP" },
      {
        property: "og:description",
        content: "Insights, previsões e recomendações para a confeitaria.",
      },
    ],
  }),
  component: InteligenciaPage,
});

const blocos = [
  { title: "Insights", description: "Padrões de venda e comportamento de clientes.", icon: Lightbulb },
  { title: "Previsões", description: "Projeção de demanda e faturamento.", icon: TrendingUp },
  { title: "Recomendações", description: "Sugestões de preço, mix e produção.", icon: Brain },
];

function InteligenciaPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Inteligência"
        description="Insights, previsões e recomendações para a confeitaria."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {blocos.map((b) => (
          <Card key={b.title} className="rounded-2xl border-border/70">
            <CardHeader>
              <CardTitle className="text-base">{b.title}</CardTitle>
              <CardDescription>{b.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState icon={b.icon} description="Sem dados suficientes para gerar análises." />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
