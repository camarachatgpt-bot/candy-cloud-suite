import { createFileRoute } from "@tanstack/react-router";
import { Target } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Candy ERP" },
      { name: "description", content: "Objetivos de faturamento, produção e equipe." },
      { property: "og:title", content: "Metas — Candy ERP" },
      { property: "og:description", content: "Objetivos de faturamento, produção e equipe." },
    ],
  }),
  component: MetasPage,
});

const items = [
  { title: "Faturamento", description: "Metas mensais e trimestrais." },
  { title: "Produção", description: "Volume de fornadas planejado." },
  { title: "Equipe", description: "Indicadores individuais." },
];

function MetasPage() {
  return (
    <ModulePlaceholder
      title="Metas"
      description="Objetivos de faturamento, produção e equipe."
      icon={Target}
      items={items}
    />
  );
}
