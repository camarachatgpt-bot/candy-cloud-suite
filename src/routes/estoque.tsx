import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Badge } from "@/components/ui/badge";
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
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
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
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [pesquisa, setPesquisa] = useState("");

  const createIngredienteMutation = useMutation({
    mutationFn: (payload: {
      nome: string;
      quantidade: number;
      estoqueMinimo: number;
    }) =>
      erpRepository.createIngrediente({
        empresa_id: null,
        nome: payload.nome,
        categoria: null,
        unidade: "un",
        quantidade: payload.quantidade,
        estoque_minimo: payload.estoqueMinimo,
        custo_unitario: 0,
        fornecedor: null,
        ativo: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      toast.success("Insumo cadastrado com sucesso.");
      setOpen(false);
      setNome("");
      setQuantidade("");
      setEstoqueMinimo("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível cadastrar o insumo.");
    },
  });

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

    createIngredienteMutation.mutate({
      nome: nome.trim(),
      quantidade: quantidadeNumero,
      estoqueMinimo: estoqueMinimoNumero,
    });
  };

  return (
    <>
      <ResourcePage
        title="Estoque"
        description="Controle de insumos, saldos e níveis mínimos."
        columns={columns}
        rows={itensFiltrados}
        getRowId={(i) => i.id}
        actionLabel="Novo insumo"
        onAction={() => setOpen(true)}
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
        onOpenChange={setOpen}
        title="Novo insumo"
        description="Cadastre um novo insumo para começar a acompanhar o estoque."
        onSubmit={handleSubmit}
        submitting={createIngredienteMutation.isPending}
      >
        <FormField id="insumo" label="Nome do insumo" value={nome} onChange={setNome} />
        <FormField
          id="quantidade"
          label="Quantidade inicial"
          type="number"
          value={quantidade}
          onChange={setQuantidade}
        />
        <FormField
          id="estoque-minimo"
          label="Estoque mínimo"
          type="number"
          value={estoqueMinimo}
          onChange={setEstoqueMinimo}
        />
      </FormModal>
    </>
  );
}
