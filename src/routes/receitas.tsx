import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import type { Ingrediente, Produto, Receita } from "@/lib/erp/types";

interface ReceitaItemForm {
  ingrediente_id: string;
  quantidade: string;
}

const TOTAL_UNIDADES_OPTIONS = ["20", "30", "40", "50", "60"];

const createEmptyReceitaItem = (): ReceitaItemForm => ({
  ingrediente_id: "",
  quantidade: "",
});

export const Route = createFileRoute("/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — Candy ERP" },
      { name: "description", content: "Ficha tecnica e composicao de receitas do catalogo." },
      { property: "og:title", content: "Receitas — Candy ERP" },
      {
        property: "og:description",
        content: "Selecao de produto, ingredientes e quantidade utilizada na ficha tecnica.",
      },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(erpQueries.receitas()),
      context.queryClient.ensureQueryData(erpQueries.produtos()),
      context.queryClient.ensureQueryData(erpQueries.ingredientes()),
    ]),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: ReceitasPage,
});

const columns: Column<Receita>[] = [
  {
    key: "produto",
    header: "Produto",
    cell: (item) => <span className="font-medium">{item.produto_nome}</span>,
  },
  {
    key: "rendimento",
    header: "Rendimento",
    cell: (item) => <span>{item.rendimento ?? 0}</span>,
  },
  {
    key: "ingredientes",
    header: "Ingredientes",
    cell: (item) => (
      <div className="space-y-1">
        {item.ingredientes.map((ingrediente) => (
          <div key={ingrediente.id} className="text-sm text-muted-foreground">
            {ingrediente.nome} · {ingrediente.quantidade} {ingrediente.unidade}
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "custo_total",
    header: "Custo total da receita",
    cell: (item) => formatCurrency(item.custo_total ?? 0),
  },
  {
    key: "custo_por_unidade",
    header: "Custo por unidade",
    cell: (item) => formatCurrency(item.custo_por_unidade ?? 0),
  },
  {
    key: "status",
    header: "Status",
    cell: (item) => (
      <Badge className="rounded-full border-0 bg-primary-soft text-accent-foreground">
        {item.ativo ? "Ativa" : "Inativa"}
      </Badge>
    ),
  },
];

function ReceitasPage() {
  const { data: receitas } = useSuspenseQuery(erpQueries.receitas());
  const { data: produtos } = useSuspenseQuery(erpQueries.produtos());
  const { data: ingredientes } = useSuspenseQuery(erpQueries.ingredientes());
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProdutoId, setSelectedProdutoId] = useState("");
  const [rendimento, setRendimento] = useState("");
  const [persistedCustoTotal, setPersistedCustoTotal] = useState(0);
  const [persistedCustoPorUnidade, setPersistedCustoPorUnidade] = useState(0);
  const [itens, setItens] = useState<ReceitaItemForm[]>([createEmptyReceitaItem()]);

  const produtoOptions = useMemo(
    () => produtos.filter((produto) => produto.ativo).sort((left, right) => left.nome.localeCompare(right.nome)),
    [produtos],
  );

  const resetForm = () => {
    setEditingId(null);
    setSelectedProdutoId("");
    setRendimento("");
    setPersistedCustoTotal(0);
    setPersistedCustoPorUnidade(0);
    setItens([createEmptyReceitaItem()]);
  };

  const openCreateModal = () => {
    resetForm();
    setOpen(true);
  };

  const openEditModal = (receita: Receita) => {
    setEditingId(receita.id);
    setSelectedProdutoId(receita.produto_id);
    setRendimento(String(receita.rendimento ?? ""));
    setPersistedCustoTotal(Number(receita.custo_total ?? 0));
    setPersistedCustoPorUnidade(Number(receita.custo_por_unidade ?? 0));
    setItens(
      receita.ingredientes.map((ingrediente) => ({
        ingrediente_id: ingrediente.ingrediente_id,
        quantidade: String(ingrediente.quantidade),
      })),
    );
    setOpen(true);
  };

  const createReceitaMutation = useMutation({
    mutationFn: (payload: {
      empresa_id: string | null;
      produto_id: string;
      rendimento: number;
      itens: Array<{ ingrediente_id: string; quantidade: number }>;
    }) => erpRepository.createReceita(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["receitas"] });
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Receita cadastrada com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível salvar a receita.");
    },
  });

  const updateReceitaMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      empresa_id: string | null;
      produto_id: string;
      rendimento: number;
      itens: Array<{ ingrediente_id: string; quantidade: number }>;
    }) => erpRepository.updateReceita(payload.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["receitas"] });
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Receita atualizada com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível atualizar a receita.");
    },
  });

  const deleteReceitaMutation = useMutation({
    mutationFn: (id: string) => erpRepository.deleteReceita(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["receitas"] });
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Receita removida com sucesso.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível remover a receita.");
    },
  });

  const ingredienteOptions = useMemo(
    () => ingredientes.sort((left, right) => left.nome.localeCompare(right.nome)),
    [ingredientes],
  );

  const custoTotal = useMemo(() => {
    if (editingId) {
      return persistedCustoTotal;
    }

    return itens.reduce((total, item) => {
      const ingrediente = ingredienteOptions.find((candidate) => candidate.id === item.ingrediente_id);
      const quantidade = Number(item.quantidade || 0);
      return total + (ingrediente?.custo_unitario ?? 0) * quantidade;
    }, 0);
  }, [editingId, ingredienteOptions, itens, persistedCustoTotal]);

  const custoPorUnidade = useMemo(() => {
    if (editingId) {
      return persistedCustoPorUnidade;
    }

    const rendimentoNumber = Number(rendimento || 0);
    return rendimentoNumber > 0 ? custoTotal / rendimentoNumber : custoTotal;
  }, [custoTotal, editingId, persistedCustoPorUnidade, rendimento]);

  const updateItem = (index: number, field: keyof ReceitaItemForm, value: string) => {
    setItens((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addItem = () => {
    setItens((current) => [...current, createEmptyReceitaItem()]);
  };

  const removeItem = (index: number) => {
    setItens((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = () => {
    const payloadItens = itens
      .map((item) => ({
        ingrediente_id: item.ingrediente_id,
        quantidade: Number(item.quantidade),
      }))
      .filter((item) => item.ingrediente_id && !Number.isNaN(item.quantidade) && item.quantidade > 0);

    if (!selectedProdutoId) {
      toast.error("Selecione um produto para a receita.");
      return;
    }

    if (!rendimento || Number(rendimento) <= 0) {
      toast.error("Informe um rendimento válido para a receita.");
      return;
    }

    if (payloadItens.length === 0) {
      toast.error("Adicione pelo menos um ingrediente com quantidade válida.");
      return;
    }

    const payload = {
      empresa_id: null,
      produto_id: selectedProdutoId,
      rendimento: Number(rendimento),
      itens: payloadItens,
    };

    if (editingId) {
      updateReceitaMutation.mutate({ id: editingId, ...payload });
      return;
    }

    createReceitaMutation.mutate(payload);
  };

  return (
    <>
      <ResourcePage
        title="Receitas"
        description="Ficha tecnica e composicao do produto em ingredientes e quantidades."
        columns={[
          ...columns,
          {
            key: "actions",
            header: "Ações",
            cell: (item: Receita) => (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl px-2"
                  onClick={() => openEditModal(item)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl px-2 text-destructive"
                  onClick={() => deleteReceitaMutation.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]}
        rows={receitas}
        getRowId={(item) => item.id}
        actionLabel="Nova receita"
        onAction={openCreateModal}
        emptyDescription="Nenhuma receita cadastrada. As fichas tecnicas aparecerao aqui."
      />

      <FormModal
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            resetForm();
          }
        }}
        title={editingId ? "Editar receita" : "Nova receita"}
        description="Selecione o produto e defina os ingredientes e suas quantidades na ficha técnica."
        onSubmit={handleSubmit}
        submitting={createReceitaMutation.isPending || updateReceitaMutation.isPending}
        submitLabel={editingId ? "Atualizar" : "Salvar"}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Produto</label>
          <Select value={selectedProdutoId} onValueChange={setSelectedProdutoId}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Selecione o produto" />
            </SelectTrigger>
            <SelectContent>
              {produtoOptions.map((produto: Produto) => (
                <SelectItem key={produto.id} value={produto.id}>
                  {produto.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <FormField
          id="rendimento"
          label="Rendimento da receita (unidades)"
          type="number"
          value={rendimento}
          onChange={setRendimento}
          placeholder="20"
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Ingredientes</label>
            <Button type="button" variant="outline" className="rounded-xl" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar ingrediente
            </Button>
          </div>

          {itens.map((item, index) => (
            <div key={`${item.ingrediente_id}-${index}`} className="grid gap-3 rounded-xl border border-border/70 p-3 md:grid-cols-[1fr_160px_auto]">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ingrediente</label>
                <Select value={item.ingrediente_id} onValueChange={(value) => updateItem(index, "ingrediente_id", value)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione o ingrediente" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredienteOptions.map((ingrediente: Ingrediente) => (
                      <SelectItem key={ingrediente.id} value={ingrediente.id}>
                        {ingrediente.nome} ({ingrediente.unidade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FormField
                id={`quantidade-${index}`}
                label="Quantidade"
                type="number"
                value={item.quantidade}
                onChange={(value) => updateItem(index, "quantidade", value)}
                placeholder="0"
              />

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-destructive"
                  onClick={() => removeItem(index)}
                  disabled={itens.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Custo total da receita</p>
              <p className="text-lg font-semibold">{formatCurrency(custoTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Custo por unidade</p>
              <p className="text-lg font-semibold">{formatCurrency(custoPorUnidade)}</p>
            </div>
          </div>
        </div>
      </FormModal>
    </>
  );
}
