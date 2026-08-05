import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas — Candy ERP" },
      { name: "description", content: "Pedidos, canais de venda e acompanhamento de entregas." },
      { property: "og:title", content: "Vendas — Candy ERP" },
      { property: "og:description", content: "Pedidos, canais de venda e acompanhamento de entregas." },
    ],
  }),
  component: VendasPage,
});

const items = [
  { title: "Pedidos", description: "Pipeline do pedido até a entrega." },
  { title: "Canais", description: "Loja física, delivery e atacado." },
  { title: "Cupons", description: "Campanhas e descontos promocionais." },
];

function VendasPage() {
  return (
    <ModulePlaceholder
      title="Vendas"
      description="Pedidos, canais de venda e acompanhamento de entregas."
      icon={ShoppingCart}
      items={items}
    />
  );
}
