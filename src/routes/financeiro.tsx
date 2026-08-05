import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Candy ERP" },
      { name: "description", content: "Contas a pagar e receber, fluxo de caixa e conciliação." },
      { property: "og:title", content: "Financeiro — Candy ERP" },
      { property: "og:description", content: "Contas a pagar e receber, fluxo de caixa e conciliação." },
    ],
  }),
  component: FinanceiroPage,
});

const items = [
  { title: "Contas a receber", description: "Recebíveis por canal de venda." },
  { title: "Contas a pagar", description: "Insumos, folha e despesas fixas." },
  { title: "Fluxo de caixa", description: "Projeção dos próximos 90 dias." },
];

function FinanceiroPage() {
  return (
    <ModulePlaceholder
      title="Financeiro"
      description="Contas a pagar e receber, fluxo de caixa e conciliação."
      icon={Wallet}
      items={items}
    />
  );
}
