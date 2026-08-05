import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import type { Produto } from "@/lib/erp/types";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Candy ERP" },
      { name: "description", content: "Catálogo de cookies gourmet, receitas e precificação." },
      { property: "og:title", content: "Produtos — Candy ERP" },
      {
        property: "og:description",
        content: "Catálogo de cookies gourmet, receitas e precificação.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.produtos()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: ProdutosPage,
});

const columns: Column<Produto>[] = [
  { key: "nome", header: "Produto", cell: (p) => <span className="font-medium">{p.nome}</span> },
  { key: "sabor", header: "Sabor", cell: (p) => p.sabor ?? "—" },
  { key: "sku", header: "SKU", cell: (p) => p.sku ?? "—" },
  { key: "custo", header: "Custo", cell: (p) => formatCurrency(p.custo) },
  { key: "preco", header: "Preço", cell: (p) => formatCurrency(p.preco_venda) },
  {
    key: "ativo",
    header: "Status",
    cell: (p) => (
      <Badge className="rounded-full border-0 bg-primary-soft text-accent-foreground">
        {p.ativo ? "Ativo" : "Inativo"}
      </Badge>
    ),
  },
];

function ProdutosPage() {
  const { data: produtos } = useSuspenseQuery(erpQueries.produtos());
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [sabor, setSabor] = useState("");
  const [preco, setPreco] = useState("");

  return (
    <>
      <ResourcePage
        title="Produtos"
        description="Catálogo de cookies gourmet, receitas e precificação."
        columns={columns}
        rows={produtos}
        getRowId={(p) => p.id}
        actionLabel="Novo produto"
        onAction={() => setOpen(true)}
        emptyDescription="Nenhum produto cadastrado. Os produtos aparecerão aqui."
      />

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Novo produto"
        description="Cadastro disponível após a conexão com o banco de dados."
        onSubmit={() => {
          toast.info("Banco de dados ainda não conectado.");
          setOpen(false);
        }}
      >
        <FormField id="nome" label="Nome" value={nome} onChange={setNome} placeholder="Cookie 90g" />
        <FormField id="sabor" label="Sabor" value={sabor} onChange={setSabor} placeholder="Belga" />
        <FormField
          id="preco"
          label="Preço de venda"
          type="number"
          value={preco}
          onChange={setPreco}
          placeholder="0,00"
        />
      </FormModal>
    </>
  );
}
