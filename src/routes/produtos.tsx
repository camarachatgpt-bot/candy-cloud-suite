import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import { handleErpError } from "@/lib/erp/error-handler";
import { ErpRouteError } from "@/lib/erp/route-error";
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
  errorComponent: ({ error }) => <ErpRouteError error={error} context={{ module: "produtos" }} />,
  component: ProdutosPage,
});

const columns: Column<Produto>[] = [
  { key: "nome", header: "Produto", cell: (p) => <span className="font-medium">{p.nome}</span> },
  { key: "sabor", header: "Sabor", cell: (p) => p.sabor ?? "—" },
  { key: "sku", header: "SKU", cell: (p) => p.sku ?? "—" },
  { key: "custo", header: "Custo", cell: (p) => formatCurrency(p.custo) },
  { key: "preco", header: "Preço", cell: (p) => formatCurrency(p.preco_venda) },
  {
    key: "margem",
    header: "Margem",
    cell: (p) => {
      const margemAtual = p.margem_atual ?? 0;
      const badgeClass = margemAtual >= 35
        ? "bg-emerald-100 text-emerald-800"
        : margemAtual >= 20
          ? "bg-amber-100 text-amber-800"
          : "bg-rose-100 text-rose-800";

      return (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{margemAtual.toFixed(1)}%</span>
          <Badge className={`rounded-full border-0 ${badgeClass}`}>
            {margemAtual >= 20 ? "Saudável" : "Ajustar"}
          </Badge>
        </div>
      );
    },
  },
  {
    key: "preco_minimo",
    header: "Preço mínimo",
    cell: (p) => formatCurrency(p.preco_minimo ?? 0),
  },
  {
    key: "preco_recomendado",
    header: "Preço ideal",
    cell: (p) => (
      <div className="flex flex-col gap-1">
        <span className="font-medium">{formatCurrency(p.preco_recomendado ?? p.preco_ideal_sugerido ?? 0)}</span>
        <span className="text-xs text-muted-foreground">{formatCurrency(p.preco_minimo ?? 0)} min</span>
      </div>
    ),
  },
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setNome("");
    setSku("");
    setPrecoCusto("");
    setPrecoVenda("");
  };

  const openCreateModal = () => {
    resetForm();
    setOpen(true);
  };

  const openEditModal = (produto: Produto) => {
    setEditingId(produto.id);
    setNome(produto.nome);
    setSku(produto.sku ?? "");
    setPrecoCusto(String(produto.custo));
    setPrecoVenda(String(produto.preco_venda));
    setOpen(true);
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
      handleErpError(error, {
        action: "salvar",
        context: { module: "produtos" },
        fallback: "Não foi possível salvar o produto.",
      });
    },
  });

  const updateProdutoMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      nome: string;
      sku: string;
      preco_custo: number;
      preco_venda: number;
      ativo: boolean;
    }) => erpRepository.updateProduto(payload.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      await queryClient.invalidateQueries({ queryKey: ["receitas"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Produto atualizado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "atualizar",
        context: { module: "produtos" },
        fallback: "Não foi possível atualizar o produto.",
      });
    },
  });

  const deleteProdutoMutation = useMutation({
    mutationFn: (id: string) => erpRepository.deleteProduto(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      await queryClient.invalidateQueries({ queryKey: ["receitas"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      toast.success("Produto removido com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "excluir",
        context: { module: "produtos" },
        fallback: "Não foi possível remover o produto.",
      });
    },
  });

  const handleDelete = (produto: Produto) => {
    const confirmed = window.confirm(`Deseja realmente excluir o produto ${produto.nome}?`);

    if (!confirmed) {
      return;
    }

    deleteProdutoMutation.mutate(produto.id);
  };

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

    if (editingId) {
      updateProdutoMutation.mutate({ id: editingId, ...payload });
      return;
    }

    createProdutoMutation.mutate(payload);
  };

  return (
    <>
      <ResourcePage
        title="Produtos"
        description="Catálogo de cookies gourmet, receitas e precificação."
        columns={[
          ...columns,
          {
            key: "actions",
            header: "Ações",
            cell: (produto: Produto) => (
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="rounded-xl px-2" onClick={() => openEditModal(produto)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl px-2 text-destructive"
                  onClick={() => handleDelete(produto)}
                  disabled={deleteProdutoMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]}
        rows={produtos}
        getRowId={(p) => p.id}
        actionLabel="Novo produto"
        onAction={openCreateModal}
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
        title={editingId ? "Editar produto" : "Novo produto"}
        description={editingId ? "Atualize os dados do produto selecionado." : "Cadastre um novo produto no catálogo."}
        onSubmit={handleSubmit}
        submitting={createProdutoMutation.isPending || updateProdutoMutation.isPending}
        submitLabel={editingId ? "Atualizar" : "Salvar"}
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
