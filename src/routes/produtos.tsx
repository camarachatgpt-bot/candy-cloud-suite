import { createFileRoute } from "@tanstack/react-router";
import { Cookie } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Candy ERP" },
      { name: "description", content: "Catálogo de cookies gourmet, receitas e precificação." },
      { property: "og:title", content: "Produtos — Candy ERP" },
      { property: "og:description", content: "Catálogo de cookies gourmet, receitas e precificação." },
    ],
  }),
  component: ProdutosPage,
});

const items = [
  { title: "Catálogo", description: "Cadastro de sabores, fotos e variações." },
  { title: "Fichas técnicas", description: "Ingredientes e rendimento por receita." },
  { title: "Precificação", description: "Custo, margem e preço sugerido." },
];

function ProdutosPage() {
  return (
    <ModulePlaceholder
      title="Produtos"
      description="Catálogo de cookies gourmet, receitas e precificação."
      icon={Cookie}
      items={items}
    />
  );
}
