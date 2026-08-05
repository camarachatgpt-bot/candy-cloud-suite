import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Candy ERP" },
      { name: "description", content: "Análises de desempenho, margem e produtividade." },
      { property: "og:title", content: "Relatórios — Candy ERP" },
      { property: "og:description", content: "Análises de desempenho, margem e produtividade." },
    ],
  }),
  component: RelatoriosPage,
});

const items = [
  { title: "Vendas", description: "Curva por período e por sabor." },
  { title: "Rentabilidade", description: "Margem por produto e canal." },
  { title: "Produção", description: "Eficiência das fornadas." },
];

function RelatoriosPage() {
  return (
    <ModulePlaceholder
      title="Relatórios"
      description="Análises de desempenho, margem e produtividade."
      icon={BarChart3}
      items={items}
    />
  );
}
