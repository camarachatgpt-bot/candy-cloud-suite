import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, ShoppingCart } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";
import { Button } from "@/components/ui/button";

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
  component: VendasPage,
});

const items = [
  { title: "Pedidos", description: "Pipeline do pedido até a entrega." },
  { title: "Canais", description: "Loja física, delivery e atacado." },
  { title: "Cupons", description: "Campanhas e descontos promocionais." },
];

function VendasPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild className="rounded-xl shadow-[var(--shadow-glow)]">
          <Link to="/vendas/nova">
            <Plus className="h-4 w-4" />
            Registrar venda
          </Link>
        </Button>
      </div>
      <ModulePlaceholder
        title="Vendas"
        description="Pedidos, canais de venda e acompanhamento de entregas."
        icon={ShoppingCart}
        items={items}
      />
    </div>
  );
}
