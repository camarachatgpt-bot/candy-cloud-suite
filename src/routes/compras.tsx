import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, formatNumber } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import type { Compra, Fornecedor, Ingrediente, ItemCompra } from "@/lib/erp/types";

export const Route = createFileRoute("/compras")({
  head: () => ({
    meta: [
      { title: "Compras — Candy ERP" },
      { name: "description", content: "Gestão de compras, fornecedores e entrada de estoque." },
      { property: "og:title", content: "Compras — Candy ERP" },
      {
        property: "og:description",
        content: "Cadastre compras, associe fornecedores e atualize o estoque automaticamente.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.compras()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: ComprasPage,
});

const columns: Column<Compra>[] = [
  { key: "data_compra", header: "Data", cell: (item) => formatDate(item.data_compra) },
  { key: "fornecedor_nome", header: "Fornecedor", cell: (item) => item.fornecedor_nome ?? "—" },
  { key: "observacao", header: "Observação", cell: (item) => item.observacao ?? "—" },
  { key: "total", header: "Total", cell: (item) => formatCurrency(item.total) },
  { key: "itens", header: "Itens", cell: (item) => String(item.itens?.length ?? 0) },
];

function ComprasPage() {
  const { data: compras } = useSuspenseQuery(erpQueries.compras());
  const { data: fornecedores } = useSuspenseQuery(erpQueries.fornecedores());
  const { data: ingredientes } = useSuspenseQuery(erpQueries.ingredientes());
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [itens, setItens] = useState<Array<{
    ingrediente_id: string;
    ingrediente_nome: string | null;
    quantidade: string;
    unidade: string;
    valor_unitario: string;
    valor_total: string;
  }>>([
    { ingrediente_id: "", ingrediente_nome: "", quantidade: "", unidade: "un", valor_unitario: "", valor_total: "" },
  ]);

  const resetForm = () => {
    setEditingId(null);
    setDataCompra(new Date().toISOString().slice(0, 10));
    setObservacao("");
    setFornecedorId("");
    setItens([
      { ingrediente_id: "", ingrediente_nome: "", quantidade: "", unidade: "un", valor_unitario: "", valor_total: "" },
    ]);
  };

  const handleItemChange = (index: number, field: keyof typeof itens[number], value: string) => {
    setItens((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value } as typeof next[number];
      if (field === "quantidade" || field === "valor_unitario") {
        const quantidade = Number(next[index].quantidade ?? 0);
        const valorUnitario = Number(next[index].valor_unitario ?? 0);
        next[index].valor_total = String(quantidade * valorUnitario);
      }
      return next;
    });
  };

  const addItem = () => {
    setItens((current) => [...current, { ingrediente_id: "", ingrediente_nome: "", quantidade: "", unidade: "un", valor_unitario: "", valor_total: "" }]);
  };

  const removeItem = (index: number) => {
    setItens((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  };

  const createCompraMutation = useMutation({
    mutationFn: (payload: {
      empresa_id: string | null;
      fornecedor_id: string | null;
      fornecedor_nome: string | null;
      data_compra: string;
      observacao: string | null;
      total: number;
      itens: Array<{
        ingrediente_id: string;
        ingrediente_nome: string | null;
        quantidade: number;
        unidade: string;
        valor_unitario: number;
        valor_total: number;
      }>;
    }) => erpRepository.createCompra(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["compras"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      toast.success("Compra cadastrada com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível salvar a compra.");
    },
  });

  const updateCompraMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      empresa_id: string | null;
      fornecedor_id: string | null;
      fornecedor_nome: string | null;
      data_compra: string;
      observacao: string | null;
      total: number;
      itens: Array<{
        ingrediente_id: string;
        ingrediente_nome: string | null;
        quantidade: number;
        unidade: string;
        valor_unitario: number;
        valor_total: number;
      }>;
    }) => erpRepository.updateCompra(payload.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["compras"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      toast.success("Compra atualizada com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível atualizar a compra.");
    },
  });

  const deleteCompraMutation = useMutation({
    mutationFn: (id: string) => erpRepository.deleteCompra(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["compras"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      toast.success("Compra removida com sucesso.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível remover a compra.");
    },
  });

  const totalCompra = useMemo(() => {
    return itens.reduce((total, item) => {
      const valorTotal = Number(item.valor_total || 0);
      return total + valorTotal;
    }, 0);
  }, [itens]);

  const handleSubmit = () => {
    const payloadItens = itens
      .filter((item) => item.ingrediente_id && item.quantidade && item.valor_unitario)
      .map((item) => ({
        ingrediente_id: item.ingrediente_id,
        ingrediente_nome: item.ingrediente_nome || null,
        quantidade: Number(item.quantidade),
        unidade: item.unidade || "un",
        valor_unitario: Number(item.valor_unitario),
        valor_total: Number(item.valor_total || Number(item.quantidade) * Number(item.valor_unitario)),
      }));

    if (payloadItens.length === 0) {
      toast.error("Adicione pelo menos um item à compra.");
      return;
    }

    const fornecedorSelecionado = fornecedores.find((fornecedor) => fornecedor.id === fornecedorId);

    const payload = {
      empresa_id: null,
      fornecedor_id: fornecedorId || null,
      fornecedor_nome: fornecedorSelecionado?.nome ?? null,
      data_compra: dataCompra,
      observacao: observacao.trim() || null,
      total: totalCompra,
      itens: payloadItens,
    };

    if (editingId) {
      updateCompraMutation.mutate({ id: editingId, ...payload });
      return;
    }

    createCompraMutation.mutate(payload);
  };

  return (
    <>
      <ResourcePage
        title="Compras"
        description="Controle de compras, fornecedores e entrada de estoque."
        columns={[
          ...columns,
          {
            key: "actions",
            header: "Ações",
            cell: (compra: Compra) => (
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="rounded-xl px-2" onClick={() => {
                  setEditingId(compra.id);
                  setDataCompra(compra.data_compra);
                  setObservacao(compra.observacao ?? "");
                  setFornecedorId(compra.fornecedor_id ?? "");
                  setItens(
                    (compra.itens ?? []).map((item: ItemCompra) => ({
                      ingrediente_id: item.ingrediente_id,
                      ingrediente_nome: item.ingrediente_nome ?? "",
                      quantidade: String(item.quantidade),
                      unidade: item.unidade,
                      valor_unitario: String(item.valor_unitario),
                      valor_total: String(item.valor_total),
                    })),
                  );
                  setOpen(true);
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="rounded-xl px-2 text-destructive" onClick={() => deleteCompraMutation.mutate(compra.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]}
        rows={compras}
        getRowId={(item) => item.id}
        actionLabel="Nova compra"
        onAction={() => {
          resetForm();
          setOpen(true);
        }}
        emptyDescription="Nenhuma compra cadastrada. As compras aparecerão aqui."
      />

      <FormModal
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            resetForm();
          }
        }}
        title={editingId ? "Editar compra" : "Nova compra"}
        description="Cadastre uma compra e atualize estoque e custos automaticamente."
        onSubmit={handleSubmit}
        submitting={createCompraMutation.isPending || updateCompraMutation.isPending}
        submitLabel={editingId ? "Atualizar" : "Salvar"}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Fornecedor</label>
          <Select value={fornecedorId} onValueChange={setFornecedorId}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Selecione o fornecedor" />
            </SelectTrigger>
            <SelectContent>
              {fornecedores.map((fornecedor: Fornecedor) => (
                <SelectItem key={fornecedor.id} value={fornecedor.id}>
                  {fornecedor.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <FormField id="data-compra" label="Data da compra" type="date" value={dataCompra} onChange={setDataCompra} />
        <FormField id="observacao" label="Observação" value={observacao} onChange={setObservacao} textarea placeholder="Detalhes da compra" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Itens da compra</p>
            <Button type="button" variant="outline" className="rounded-xl" onClick={addItem}>
              Adicionar item
            </Button>
          </div>

          {itens.map((item, index) => (
            <div key={`${item.ingrediente_id || index}-${index}`} className="rounded-2xl border border-border/70 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Item {index + 1}</p>
                {itens.length > 1 ? (
                  <Button type="button" variant="ghost" size="sm" className="rounded-xl px-2 text-destructive" onClick={() => removeItem(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ingrediente</label>
                <Select
                  value={item.ingrediente_id}
                  onValueChange={(value) => {
                    const ingrediente = ingredientes.find((entry: Ingrediente) => entry.id === value);
                    handleItemChange(index, "ingrediente_id", value);
                    handleItemChange(index, "ingrediente_nome", ingrediente?.nome ?? "");
                    handleItemChange(index, "unidade", ingrediente?.unidade ?? "un");
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione o ingrediente" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredientes.map((ingrediente: Ingrediente) => (
                      <SelectItem key={ingrediente.id} value={ingrediente.id}>
                        {ingrediente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <FormField id={`quantidade-${index}`} label="Quantidade" type="number" value={item.quantidade} onChange={(value) => handleItemChange(index, "quantidade", value)} placeholder="0" />
                <FormField id={`valor-unitario-${index}`} label="Valor unitário" type="number" value={item.valor_unitario} onChange={(value) => handleItemChange(index, "valor_unitario", value)} placeholder="0,00" />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/20 px-3 py-2 text-sm">
                <span>Total do item</span>
                <span className="font-semibold">{formatCurrency(Number(item.valor_total || 0))}</span>
              </div>
            </div>
          ))}

          <div className="rounded-xl bg-muted/20 p-3 text-sm font-medium">
            Total da compra: {formatCurrency(totalCompra)}
          </div>
        </div>
      </FormModal>
    </>
  );
}
