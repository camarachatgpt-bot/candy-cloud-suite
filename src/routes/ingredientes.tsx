import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Search, Trash2 } from "lucide-react";
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
import { formatCurrency, formatNumber } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import { handleErpError } from "@/lib/erp/error-handler";
import { ErpRouteError } from "@/lib/erp/route-error";
import type { Ingrediente } from "@/lib/erp/types";

const UNIDADE_OPTIONS = ["kg", "g", "ml", "un"] as const;
const UNIDADE_COMPRA_OPTIONS = ["g", "kg", "ml", "L", "un", "pacote", "caixa"] as const;
const DEFAULT_UNIDADE = UNIDADE_OPTIONS[0] ?? "kg";
const DEFAULT_UNIDADE_COMPRA = UNIDADE_COMPRA_OPTIONS[0] ?? "g";

function parseDecimalValue(value: string): number {
  const raw = value.trim();
  const normalized = raw.includes(",") && raw.includes(".")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function converterQuantidadeParaUnidadeBase(quantidadeCompra: number, unidadeCompra: string): number {
  if (unidadeCompra === "kg" || unidadeCompra === "L") {
    return quantidadeCompra * 1000;
  }

  return quantidadeCompra;
}

function obterUnidadeCustoCalculado(unidadeCompra: string): string {
  if (unidadeCompra === "kg") return "g";
  if (unidadeCompra === "L") return "ml";
  return unidadeCompra;
}

function formatCalculatedCost(value: number): string {
  const minimumFractionDigits = value > 0 && value < 1 ? 5 : 2;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits,
    maximumFractionDigits: 5,
  }).format(value);
}

function getLegacyUnidadeCompra(unidade: string): string {
  if (unidade === "kg") return "g";
  if (unidade === "L") return "ml";
  if ((UNIDADE_COMPRA_OPTIONS as readonly string[]).includes(unidade)) return unidade;
  return "un";
}

export const Route = createFileRoute("/ingredientes")({
  head: () => ({
    meta: [
      { title: "Ingredientes — Candy ERP" },
      { name: "description", content: "Gestão de ingredientes e estoque inteligente." },
      { property: "og:title", content: "Ingredientes — Candy ERP" },
      {
        property: "og:description",
        content: "Controle de ingredientes, unidade, custo e estoque mínimo.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.ingredientes()),
  errorComponent: ({ error }) => <ErpRouteError error={error} context={{ module: "ingredientes" }} />,
  component: IngredientesPage,
});

const columns: Column<Ingrediente>[] = [
  {
    key: "nome",
    header: "Ingrediente",
    cell: (item) => <span className="font-medium">{item.nome}</span>,
  },
  { key: "categoria", header: "Categoria", cell: (item) => item.categoria ?? "—" },
  { key: "unidade", header: "Unidade", cell: (item) => item.unidade },
  { key: "quantidade", header: "Estoque atual", cell: (item) => formatNumber(item.quantidade) },
  {
    key: "estoque_minimo",
    header: "Estoque mínimo",
    cell: (item) => formatNumber(item.estoque_minimo),
  },
  {
    key: "custo_unitario",
    header: "Custo unitário",
    cell: (item) => formatCurrency(item.custo_unitario),
  },
  { key: "fornecedor", header: "Fornecedor", cell: (item) => item.fornecedor ?? "—" },
  {
    key: "ativo",
    header: "Status",
    cell: (item) => (
      <Badge className="rounded-full border-0 bg-primary-soft text-accent-foreground">
        {item.ativo ? "Ativo" : "Inativo"}
      </Badge>
    ),
  },
];

function IngredientesPage() {
  const { data: ingredientes } = useSuspenseQuery(erpQueries.ingredientes());
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState<string>(DEFAULT_UNIDADE);
  const [quantidade, setQuantidade] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [precoPago, setPrecoPago] = useState("");
  const [quantidadeComprada, setQuantidadeComprada] = useState("");
  const [unidadeCompra, setUnidadeCompra] = useState<string>(DEFAULT_UNIDADE_COMPRA);
  const [fornecedor, setFornecedor] = useState("");

  const categoriaOptions = useMemo(
    () => ["todos", ...new Set(ingredientes.map((item) => item.categoria).filter(Boolean) as string[])],
    [ingredientes],
  );

  const filteredIngredientes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...ingredientes]
      .filter((item) => {
        const matchesSearch =
          normalizedSearch.length === 0 || item.nome.toLowerCase().includes(normalizedSearch);
        const matchesCategory =
          categoriaFiltro === "todos" || item.categoria?.toLowerCase() === categoriaFiltro.toLowerCase();

        return matchesSearch && matchesCategory;
      })
      .sort((left, right) => {
        const lowStockLeft = left.quantidade <= left.estoque_minimo ? 0 : 1;
        const lowStockRight = right.quantidade <= right.estoque_minimo ? 0 : 1;

        if (lowStockLeft !== lowStockRight) {
          return lowStockLeft - lowStockRight;
        }

        if (left.quantidade !== right.quantidade) {
          return left.quantidade - right.quantidade;
        }

        return left.nome.localeCompare(right.nome);
      });
  }, [categoriaFiltro, ingredientes, search]);

  const precoPagoNumero = useMemo(() => parseDecimalValue(precoPago), [precoPago]);
  const quantidadeCompradaNumero = useMemo(() => parseDecimalValue(quantidadeComprada), [quantidadeComprada]);

  const custoUnitarioCalculado = useMemo(() => {
    if (Number.isNaN(precoPagoNumero) || Number.isNaN(quantidadeCompradaNumero)) {
      return Number.NaN;
    }

    if (quantidadeCompradaNumero <= 0) {
      return Number.NaN;
    }

    const quantidadeBase = converterQuantidadeParaUnidadeBase(quantidadeCompradaNumero, unidadeCompra);

    if (quantidadeBase <= 0) {
      return Number.NaN;
    }

    return precoPagoNumero / quantidadeBase;
  }, [precoPagoNumero, quantidadeCompradaNumero, unidadeCompra]);

  const unidadeCustoCalculado = useMemo(() => obterUnidadeCustoCalculado(unidadeCompra), [unidadeCompra]);

  const resetForm = () => {
    setEditingId(null);
    setNome("");
    setCategoria("");
    setUnidade(DEFAULT_UNIDADE);
    setQuantidade("");
    setEstoqueMinimo("");
    setPrecoPago("");
    setQuantidadeComprada("");
    setUnidadeCompra(DEFAULT_UNIDADE_COMPRA);
    setFornecedor("");
  };

  const openCreateModal = () => {
    resetForm();
    setOpen(true);
  };

  const openEditModal = (item: Ingrediente) => {
    setEditingId(item.id);
    setNome(item.nome);
    setCategoria(item.categoria ?? "");
    setUnidade(item.unidade ?? DEFAULT_UNIDADE);
    setQuantidade(String(item.quantidade));
    setEstoqueMinimo(String(item.estoque_minimo));
    setPrecoPago(item.preco_pago == null ? String(item.custo_unitario) : String(item.preco_pago));
    setQuantidadeComprada(item.quantidade_compra == null ? "1" : String(item.quantidade_compra));
    setUnidadeCompra(item.unidade_compra ?? getLegacyUnidadeCompra(item.unidade));
    setFornecedor(item.fornecedor ?? "");
    setOpen(true);
  };

  const createIngredienteMutation = useMutation({
    mutationFn: (payload: {
      empresa_id: string | null;
      nome: string;
      categoria: string | null;
      unidade: string;
      quantidade: number;
      estoque_minimo: number;
      custo_unitario: number;
      preco_pago: number;
      quantidade_compra: number;
      unidade_compra: string;
      fornecedor: string | null;
      ativo: boolean;
    }) => erpRepository.createIngrediente(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes-estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Ingrediente cadastrado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "salvar",
        context: { module: "ingredientes" },
        fallback: "Não foi possível salvar o ingrediente.",
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
      estoque_minimo: number;
      custo_unitario: number;
      preco_pago: number;
      quantidade_compra: number;
      unidade_compra: string;
      fornecedor: string | null;
      ativo: boolean;
    }) => erpRepository.updateIngrediente(payload.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes-estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Ingrediente atualizado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "atualizar",
        context: { module: "ingredientes" },
        fallback: "Não foi possível atualizar o ingrediente.",
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
      toast.success("Ingrediente removido com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "excluir",
        context: { module: "ingredientes" },
        fallback: "Não foi possível remover o ingrediente.",
      });
    },
  });

  const handleDeleteIngrediente = (item: Ingrediente) => {
    const confirmed = window.confirm(`Deseja realmente excluir o ingrediente ${item.nome}?`);

    if (!confirmed) {
      return;
    }

    deleteIngredienteMutation.mutate(item.id);
  };

  const handleSubmit = () => {
    const payload = {
      empresa_id: null,
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      unidade: unidade.trim() || UNIDADE_OPTIONS[0],
      quantidade: Number(quantidade),
      estoque_minimo: Number(estoqueMinimo),
      custo_unitario: custoUnitarioCalculado,
      preco_pago: precoPagoNumero,
      quantidade_compra: quantidadeCompradaNumero,
      unidade_compra: unidadeCompra,
      fornecedor: fornecedor.trim() || null,
      ativo: true,
    };

    if (!payload.nome || !payload.unidade) {
      toast.error("Preencha nome e unidade do ingrediente.");
      return;
    }

    if (
      Number.isNaN(payload.quantidade) ||
      Number.isNaN(payload.estoque_minimo) ||
      Number.isNaN(payload.preco_pago) ||
      Number.isNaN(payload.quantidade_compra) ||
      Number.isNaN(payload.custo_unitario)
    ) {
      toast.error("Quantidade, estoque mínimo, preço pago e quantidade comprada devem ser números válidos.");
      return;
    }

    if (payload.quantidade_compra <= 0) {
      toast.error("A quantidade comprada deve ser maior que zero.");
      return;
    }

    if (editingId) {
      updateIngredienteMutation.mutate({ id: editingId, ...payload, ativo: true });
      return;
    }

    createIngredienteMutation.mutate(payload);
  };

  return (
    <>
      <ResourcePage
        title="Ingredientes"
        description="Cadastro de ingredientes e controle de estoque inteligente."
        columns={[
          ...columns,
          {
            key: "actions",
            header: "Ações",
            cell: (item: Ingrediente) => (
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
                  onClick={() => handleDeleteIngrediente(item)}
                  disabled={deleteIngredienteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]}
        rows={filteredIngredientes}
        getRowId={(item) => item.id}
        actionLabel="Novo ingrediente"
        onAction={openCreateModal}
        emptyDescription="Nenhum ingrediente cadastrado. Os ingredientes aparecerão aqui."
        toolbar={
          <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar por nome"
                className="rounded-xl pl-9"
              />
            </div>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriaOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "todos" ? "Todas as categorias" : option}
                  </SelectItem>
                ))}
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
        title={editingId ? "Editar ingrediente" : "Novo ingrediente"}
        description="Cadastre ou edite um ingrediente para o estoque inteligente."
        onSubmit={handleSubmit}
        submitting={createIngredienteMutation.isPending || updateIngredienteMutation.isPending}
        submitLabel={editingId ? "Atualizar" : "Salvar"}
      >
        <FormField id="nome" label="Nome" value={nome} onChange={setNome} placeholder="Farinha de trigo" />
        <FormField
          id="categoria"
          label="Categoria"
          value={categoria}
          onChange={setCategoria}
          placeholder="Base, cobertura, etc."
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">Unidade de medida</label>
          <Select value={unidade} onValueChange={(value) => setUnidade(value)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {UNIDADE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <FormField
          id="quantidade"
          label="Estoque atual"
          type="number"
          value={quantidade}
          onChange={setQuantidade}
          placeholder="0"
        />
        <FormField
          id="estoqueMinimo"
          label="Estoque mínimo"
          type="number"
          value={estoqueMinimo}
          onChange={setEstoqueMinimo}
          placeholder="0"
        />
        <FormField
          id="precoPago"
          label="Preço pago (R$)"
          value={precoPago}
          onChange={setPrecoPago}
          placeholder="0,00"
        />
        <FormField
          id="quantidadeComprada"
          label="Quantidade comprada"
          type="number"
          value={quantidadeComprada}
          onChange={setQuantidadeComprada}
          placeholder="1"
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">Unidade da compra</label>
          <Select value={unidadeCompra} onValueChange={(value) => setUnidadeCompra(value)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Selecione a unidade de compra" />
            </SelectTrigger>
            <SelectContent>
              {UNIDADE_COMPRA_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Custo unitário calculado</label>
          <Input
            readOnly
            value={
              Number.isNaN(custoUnitarioCalculado)
                ? "Preencha preço, quantidade e unidade da compra"
                : `${formatCalculatedCost(custoUnitarioCalculado)}/${unidadeCustoCalculado}`
            }
            className="rounded-xl"
          />
        </div>
        <FormField
          id="fornecedor"
          label="Fornecedor"
          value={fornecedor}
          onChange={setFornecedor}
          placeholder="Distribuidora"
        />
      </FormModal>
    </>
  );
}
