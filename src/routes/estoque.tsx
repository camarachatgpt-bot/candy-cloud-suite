import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Candy ERP" },
      { name: "description", content: "Controle de insumos, lotes e reposição automática." },
      { property: "og:title", content: "Estoque — Candy ERP" },
      { property: "og:description", content: "Controle de insumos, lotes e reposição automática." },
    ],
  }),
  component: EstoquePage,
});

const items = [
  { title: "Insumos", description: "Chocolate, manteiga, farinhas e recheios." },
  { title: "Lotes e validade", description: "Rastreabilidade por lote de produção." },
  { title: "Reposição", description: "Alertas de estoque mínimo." },
];

function EstoquePage() {
  return (
    <ModulePlaceholder
      title="Estoque"
      description="Controle de insumos, lotes e reposição automática."
      icon={Package}
      items={items}
    />
  );
}
