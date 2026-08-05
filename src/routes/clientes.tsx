import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Candy ERP" },
      { name: "description", content: "Base de clientes, histórico de compras e fidelidade." },
      { property: "og:title", content: "Clientes — Candy ERP" },
      { property: "og:description", content: "Base de clientes, histórico de compras e fidelidade." },
    ],
  }),
  component: ClientesPage,
});

const items = [
  { title: "Cadastro", description: "Pessoa física e jurídica." },
  { title: "Histórico", description: "Compras, ticket médio e recorrência." },
  { title: "Fidelidade", description: "Pontos e recompensas." },
];

function ClientesPage() {
  return (
    <ModulePlaceholder
      title="Clientes"
      description="Base de clientes, histórico de compras e fidelidade."
      icon={Users}
      items={items}
    />
  );
}
