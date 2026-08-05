import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
import { erpRepository } from "@/lib/erp/repository";
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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");

  const resetForm = () => {
    setNome("");
    setSku("");
    setPrecoCusto("");
    setPrecoVenda("");
  };

  const createProdutoMutation = useMutation({
    mutationFn: (payload: {
      nome: string;
      sku: string;
      preco_custo: number;
      preco_venda: number;
      ativo: boolean;
    }) => erpRepository.createProduto(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Produto cadastrado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível salvar o produto.");
    },
  });

  const handleSubmit = () => {
    const payload = {
      nome: nome.trim(),
      sku: sku.trim(),
      preco_custo: Number(precoCusto),
      preco_venda: Number(precoVenda),
      ativo: true,
    };

    if (!payload.nome || !payload.sku || Number.isNaN(payload.preco_custo) || Number.isNaN(payload.preco_venda)) {
      toast.error("Preencha nome, SKU e os preços corretamente.");
      return;
    }

    createProdutoMutation.mutate(payload);
  };

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
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            resetForm();
          }
        }}
        title="Novo produto"
        description="Cadastre um novo produto no catálogo."
        onSubmit={handleSubmit}
        submitting={createProdutoMutation.isPending}
      >
        <FormField id="nome" label="Nome" value={nome} onChange={setNome} placeholder="Cookie 90g" />
        <FormField id="sku" label="SKU" value={sku} onChange={setSku} placeholder="CK-001" />
        <FormField
          id="precoCusto"
          label="Preço de custo"
          type="number"
          value={precoCusto}
          onChange={setPrecoCusto}
          placeholder="0,00"
        />
        <FormField
          id="precoVenda"
          label="Preço de venda"
          type="number"
          value={precoVenda}
          onChange={setPrecoVenda}
          placeholder="0,00"
        />
      </FormModal>
    </>
  );
}
