import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatNumber } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import { handleErpError } from "@/lib/erp/error-handler";
import { ErpRouteError } from "@/lib/erp/route-error";
import type { ItemEstoque } from "@/lib/erp/types";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Candy ERP" },
      { name: "description", content: "Controle de insumos, saldos e níveis mínimos de estoque." },
      { property: "og:title", content: "Estoque — Candy ERP" },
      {
        property: "og:description",
        content: "Controle de insumos, saldos e níveis mínimos de estoque.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.estoque()),
  errorComponent: ({ error }) => <ErpRouteError error={error} context={{ module: "estoque" }} />,
  component: EstoquePage,
});

type StatusFiltro = "todos" | "normal" | "atencao" | "critico";

function getStatusValue(quantidade: number, minimo: number): StatusFiltro {
  if (quantidade < minimo) {
    return "critico";
  }

  if (quantidade === minimo) {
    return "atencao";
  }

  return "normal";
}

function getStatusLabel(status: StatusFiltro) {
  switch (status) {
    case "critico":
      return "Crítico";
    case "atencao":
      return "Atenção";
    default:
      return "Normal";
  }
}

const columns: Column<ItemEstoque>[] = [
  { key: "insumo", header: "Nome do ingrediente", cell: (i) => <span className="font-medium">{i.insumo}</span> },
  { key: "categoria", header: "Categoria", cell: () => "—" },
  { key: "unidade", header: "Unidade", cell: (i) => i.unidade },
  { key: "quantidade", header: "Estoque atual", cell: (i) => `${formatNumber(i.quantidade)} ${i.unidade}` },
  { key: "minimo", header: "Estoque mínimo", cell: (i) => `${formatNumber(i.minimo)} ${i.unidade}` },
  { key: "status", header: "Status", cell: (i) => {
      const status = getStatusValue(i.quantidade, i.minimo);
      const className =
        status === "critico"
          ? "border-0 bg-destructive/10 text-destructive"
          : status === "atencao"
            ? "border-0 bg-amber-500/10 text-amber-700"
            : "border-0 bg-emerald-500/10 text-emerald-700";

      return <Badge className={className}>{getStatusLabel(status)}</Badge>;
    } },
  { key: "atualizado", header: "Atualizado em", cell: (i) => formatDate(i.atualizado_em) },
];

function EstoquePage() {
  const { data: itens } = useSuspenseQuery(erpQueries.estoque());
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [pesquisa, setPesquisa] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setNome("");
    setCategoria("");
    setUnidade("un");
    setQuantidade("");
    setEstoqueMinimo("");
    setObservacao("");
  };

  const openCreateModal = () => {
    resetForm();
    setOpen(true);
  };

  const openEditModal = (item: ItemEstoque) => {
    const ingrediente = itens.find((entry) => entry.id === item.id);

    setEditingId(item.id);
    setNome(item.insumo);
    setCategoria(item.categoria ?? "");
    setUnidade(item.unidade || "un");
    setQuantidade(String(item.quantidade));
    setEstoqueMinimo(String(item.minimo));
    setObservacao(ingrediente?.observacao ?? "");
    setOpen(true);
  };

  const createIngredienteMutation = useMutation({
    mutationFn: (payload: {
      nome: string;
      categoria: string | null;
      unidade: string;
      quantidade: number;
      estoqueMinimo: number;
      observacao: string | null;
    }) =>
      erpRepository.createIngrediente({
        empresa_id: null,
        nome: payload.nome,
        categoria: payload.categoria,
        unidade: payload.unidade,
        quantidade: payload.quantidade,
        estoque_minimo: payload.estoqueMinimo,
        custo_unitario: 0,
        fornecedor: null,
        observacao: payload.observacao,
        ativo: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes-estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Insumo cadastrado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "cadastrar",
        context: { module: "estoque" },
        fallback: "Não foi possível cadastrar o insumo.",
      });
    },
  });

  const updateIngredienteMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      nome: string;
      categoria: string | null;
      unidade: string;
      quantidade: number;
      estoqueMinimo: number;
      observacao: string | null;
    }) =>
      erpRepository.updateIngrediente(payload.id, {
        nome: payload.nome,
        categoria: payload.categoria,
        unidade: payload.unidade,
        quantidade: payload.quantidade,
        estoque_minimo: payload.estoqueMinimo,
        custo_unitario: 0,
        fornecedor: null,
        observacao: payload.observacao,
        ativo: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes-estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Insumo atualizado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "atualizar",
        context: { module: "estoque" },
        fallback: "Não foi possível atualizar o insumo.",
      });
    },
  });

  const deleteIngredienteMutation = useMutation({
    mutationFn: (id: string) => erpRepository.deleteIngrediente(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes-estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Insumo removido com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "excluir",
        context: { module: "estoque" },
        fallback: "Não foi possível remover o insumo.",
      });
    },
  });

  const handleDelete = (item: ItemEstoque) => {
    const confirmed = window.confirm(`Deseja realmente excluir o insumo ${item.insumo}?`);

    if (!confirmed) {
      return;
    }

    deleteIngredienteMutation.mutate(item.id);
  };

  const itensFiltrados = useMemo(() => {
    const busca = pesquisa.trim().toLowerCase();

    return itens
      .filter((item) => {
        if (busca && !item.insumo.toLowerCase().includes(busca)) {
          return false;
        }

        if (filtroStatus === "todos") {
          return true;
        }

        return getStatusValue(item.quantidade, item.minimo) === filtroStatus;
      })
      .sort((left, right) => {
        const leftStatus = getStatusValue(left.quantidade, left.minimo);
        const rightStatus = getStatusValue(right.quantidade, right.minimo);
        const prioridade: Record<StatusFiltro, number> = { todos: 2, critico: 0, atencao: 1, normal: 2 };

        return prioridade[leftStatus] - prioridade[rightStatus] || left.insumo.localeCompare(right.insumo);
      });
  }, [filtroStatus, itens, pesquisa]);

  const handleSubmit = () => {
    const quantidadeNumero = Number(quantidade);
    const estoqueMinimoNumero = Number(estoqueMinimo);

    if (!nome.trim()) {
      toast.error("Informe o nome do insumo.");
      return;
    }

    if (Number.isNaN(quantidadeNumero)) {
      toast.error("Informe a quantidade inicial.");
      return;
    }

    if (Number.isNaN(estoqueMinimoNumero)) {
      toast.error("Informe o estoque mínimo.");
      return;
    }

    const payload = {
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      unidade: unidade.trim() || "un",
      quantidade: quantidadeNumero,
      estoqueMinimo: estoqueMinimoNumero,
      observacao: observacao.trim() || null,
    };

    if (!payload.nome || !payload.unidade) {
      toast.error("Informe o nome e a unidade do insumo.");
      return;
    }

    if (Number.isNaN(payload.quantidade) && !editingId) {
      toast.error("Informe a quantidade inicial.");
      return;
    }

    if (Number.isNaN(payload.estoqueMinimo)) {
      toast.error("Informe o estoque mínimo.");
      return;
    }

    if (editingId) {
      updateIngredienteMutation.mutate({ id: editingId, ...payload, quantidade: Number(quantidade || 0) });
      return;
    }

    createIngredienteMutation.mutate(payload);
  };

  return (
    <>
      <ResourcePage
        title="Estoque"
        description="Controle de insumos, saldos e níveis mínimos."
        columns={[
          ...columns,
          {
            key: "actions",
            header: "Ações",
            cell: (item: ItemEstoque) => (
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="rounded-xl px-2" onClick={() => openEditModal(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="rounded-xl px-2 text-destructive" onClick={() => handleDelete(item)} disabled={deleteIngredienteMutation.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]}
        rows={itensFiltrados}
        getRowId={(i) => i.id}
        actionLabel="Novo insumo"
        onAction={openCreateModal}
        emptyDescription="Nenhum insumo cadastrado. Os saldos aparecerão aqui."
        toolbar={
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              placeholder="Pesquisar por nome"
              value={pesquisa}
              onChange={(event) => setPesquisa(event.target.value)}
              className="rounded-xl md:max-w-sm"
            />
            <Select value={filtroStatus} onValueChange={(value) => setFiltroStatus(value as StatusFiltro)}>
              <SelectTrigger className="rounded-xl md:w-[180px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="atencao">Atenção</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <FormModal
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            resetForm();
          }
        }}
        title={editingId ? "Editar insumo" : "Novo insumo"}
        description={editingId ? "Atualize as informações do insumo sem alterar o estoque atual." : "Cadastre um novo insumo para começar a acompanhar o estoque."}
        onSubmit={handleSubmit}
        submitting={createIngredienteMutation.isPending || updateIngredienteMutation.isPending}
        submitLabel={editingId ? "Atualizar" : "Salvar"}
      >
        <FormField id="insumo" label="Nome do insumo" value={nome} onChange={setNome} />
        <FormField id="categoria" label="Categoria" value={categoria} onChange={setCategoria} placeholder="Base, cobertura, etc." />
        <div className="space-y-2">
          <label className="text-sm font-medium">Unidade</label>
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="g">g</SelectItem>
              <SelectItem value="ml">ml</SelectItem>
              <SelectItem value="un">un</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!editingId ? (
          <FormField id="quantidade" label="Quantidade inicial" type="number" value={quantidade} onChange={setQuantidade} />
        ) : null}
        <FormField id="estoque-minimo" label="Estoque mínimo" type="number" value={estoqueMinimo} onChange={setEstoqueMinimo} />
        <FormField id="observacao" label="Observação" value={observacao} onChange={setObservacao} textarea placeholder="Detalhes adicionais do insumo" />
      </FormModal>
    </>
  );
}
