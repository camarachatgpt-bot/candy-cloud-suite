import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — Candy ERP" },
      { name: "description", content: "Parceiros de insumos, cotações e prazos de entrega." },
      { property: "og:title", content: "Fornecedores — Candy ERP" },
      { property: "og:description", content: "Parceiros de insumos, cotações e prazos de entrega." },
    ],
  }),
  component: FornecedoresPage,
});

const items = [
  { title: "Parceiros", description: "Cadastro e condições comerciais." },
  { title: "Cotações", description: "Comparativo de preços de insumos." },
  { title: "Entregas", description: "Prazos e desempenho de fornecimento." },
];

function FornecedoresPage() {
  return (
    <ModulePlaceholder
      title="Fornecedores"
      description="Parceiros de insumos, cotações e prazos de entrega."
      icon={Truck}
      items={items}
    />
  );
}
