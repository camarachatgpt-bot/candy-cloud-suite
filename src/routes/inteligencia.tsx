import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/inteligencia")({
  head: () => ({
    meta: [
      { title: "Inteligência — Candy ERP" },
      { name: "description", content: "Previsões e recomendações inteligentes para a operação." },
      { property: "og:title", content: "Inteligência — Candy ERP" },
      { property: "og:description", content: "Previsões e recomendações inteligentes para a operação." },
    ],
  }),
  component: InteligenciaPage,
});

const items = [
  { title: "Previsão de demanda", description: "Estimativa por sabor e sazonalidade." },
  { title: "Sugestões", description: "Compras e produção recomendadas." },
  { title: "Alertas", description: "Anomalias em vendas e custos." },
];

function InteligenciaPage() {
  return (
    <ModulePlaceholder
      title="Inteligência"
      description="Previsões e recomendações inteligentes para a operação."
      icon={Bot}
      items={items}
    />
  );
}
