import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { handleErpError } from "@/lib/erp/error-handler";
import { ErpRouteError } from "@/lib/erp/route-error";
import type { Compra, Fornecedor, Ingrediente, ItemCompra } from "@/lib/erp/types";

const AUTO_ATUALIZAR_CUSTO_PELA_ULTIMA_COMPRA = false;

interface CostUpdateDecision {
  ingrediente_id: string;
  atualizar: boolean;
  preco_pago: number;
  quantidade_compra: number;
  unidade_compra: string;
  custo_unitario_novo: number;
}

interface CostUpdatePrompt {
  ingredienteNome: string;
  custoAtual: number;
  novoCusto: number;
  resolve: (decision: boolean) => void;
}

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
  errorComponent: ({ error }) => <ErpRouteError error={error} context={{ module: "compras" }} />,
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
  const [parcelamento, setParcelamento] = useState({ parcelas: "1", intervaloDias: "30" });
  const [resolvendoAtualizacaoCustos, setResolvendoAtualizacaoCustos] = useState(false);
  const [costUpdatePrompt, setCostUpdatePrompt] = useState<CostUpdatePrompt | null>(null);
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
    setParcelamento({ parcelas: "1", intervaloDias: "30" });
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
      atualizacoes_custo?: CostUpdateDecision[];
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
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Compra cadastrada com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "salvar",
        context: { module: "compras" },
        fallback: "Não foi possível salvar a compra.",
      });
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
      atualizacoes_custo?: CostUpdateDecision[];
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
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Compra atualizada com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "atualizar",
        context: { module: "compras" },
        fallback: "Não foi possível atualizar a compra.",
      });
    },
  });

  const deleteCompraMutation = useMutation({
    mutationFn: (id: string) => erpRepository.deleteCompra(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["compras"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      await queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      toast.success("Compra removida com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "excluir",
        context: { module: "compras" },
        fallback: "Não foi possível remover a compra.",
      });
    },
  });

  const handleDeleteCompra = (compra: Compra) => {
    const confirmed = window.confirm(`Deseja realmente excluir a compra ${compra.id}?`);

    if (!confirmed) {
      return;
    }

    deleteCompraMutation.mutate(compra.id);
  };

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
      parcelamento: Number(parcelamento.parcelas) > 1 ? {
        parcelas: Number(parcelamento.parcelas),
        intervaloDias: Number(parcelamento.intervaloDias),
      } : null,
      itens: payloadItens,
    };

    const solicitarAtualizacaoCusto = (input: {
      ingredienteNome: string;
      custoAtual: number;
      novoCusto: number;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setCostUpdatePrompt({
          ingredienteNome: input.ingredienteNome,
          custoAtual: input.custoAtual,
          novoCusto: input.novoCusto,
          resolve,
        });
      });
    };

    const confirmarAtualizacoes = async (): Promise<CostUpdateDecision[]> => {
      const diferencas = payloadItens
        .map((item) => {
          const ingrediente = ingredientes.find((entry: Ingrediente) => entry.id === item.ingrediente_id);
          const custoAtual = Number(ingrediente?.custo_unitario ?? 0);
          const novoCusto = Number(item.valor_unitario ?? 0);
          const custoAlterado = Math.abs(custoAtual - novoCusto) > 0.000001;

          return {
            item,
            ingrediente,
            custoAtual,
            novoCusto,
            custoAlterado,
          };
        })
        .filter((entry) => entry.custoAlterado && entry.ingrediente);

      if (diferencas.length === 0) {
        return [];
      }

      const decisoes: CostUpdateDecision[] = [];

      for (const diferenca of diferencas) {
        const shouldUpdate = AUTO_ATUALIZAR_CUSTO_PELA_ULTIMA_COMPRA
          ? true
          : await solicitarAtualizacaoCusto({
              ingredienteNome: diferenca.ingrediente?.nome ?? "Ingrediente",
              custoAtual: diferenca.custoAtual,
              novoCusto: diferenca.novoCusto,
            });

        decisoes.push({
          ingrediente_id: diferenca.item.ingrediente_id,
          atualizar: shouldUpdate,
          preco_pago: diferenca.item.valor_total,
          quantidade_compra: diferenca.item.quantidade,
          unidade_compra: diferenca.item.unidade,
          custo_unitario_novo: diferenca.novoCusto,
        });
      }

      return decisoes;
    };

    const persistirCompra = async () => {
      setResolvendoAtualizacaoCustos(true);
      const atualizacoes_custo = await confirmarAtualizacoes();

      if (editingId) {
        updateCompraMutation.mutate({ id: editingId, ...payload, atualizacoes_custo });
        setResolvendoAtualizacaoCustos(false);
        return;
      }

      createCompraMutation.mutate({ ...payload, atualizacoes_custo });
      setResolvendoAtualizacaoCustos(false);
    };

    void persistirCompra();
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
                <Button type="button" variant="ghost" size="sm" className="rounded-xl px-2 text-destructive" onClick={() => handleDeleteCompra(compra)} disabled={deleteCompraMutation.isPending}>
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
        description="Cadastre uma compra e atualize o estoque. Se o custo mudar, você poderá confirmar a atualização no cadastro do ingrediente."
        onSubmit={handleSubmit}
        submitting={createCompraMutation.isPending || updateCompraMutation.isPending || resolvendoAtualizacaoCustos}
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

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Parcelas</label>
            <Select value={parcelamento.parcelas} onValueChange={(value) => setParcelamento((current) => ({ ...current, parcelas: value }))}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Parcelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 parcela</SelectItem>
                <SelectItem value="2">2 parcelas</SelectItem>
                <SelectItem value="3">3 parcelas</SelectItem>
                <SelectItem value="4">4 parcelas</SelectItem>
                <SelectItem value="6">6 parcelas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Intervalo (dias)</label>
            <Select value={parcelamento.intervaloDias} onValueChange={(value) => setParcelamento((current) => ({ ...current, intervaloDias: value }))}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Intervalo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="45">45 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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

      <AlertDialog
        open={Boolean(costUpdatePrompt)}
        onOpenChange={(isOpen) => {
          if (!isOpen && costUpdatePrompt) {
            costUpdatePrompt.resolve(false);
            setCostUpdatePrompt(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O custo deste ingrediente mudou.</AlertDialogTitle>
            <AlertDialogDescription>
              Ingrediente: {costUpdatePrompt?.ingredienteNome ?? "Ingrediente"}
              <br />
              Custo atual: {formatCurrency(costUpdatePrompt?.custoAtual ?? 0)}
              <br />
              Novo custo calculado pela compra: {formatCurrency(costUpdatePrompt?.novoCusto ?? 0)}
              <br />
              Deseja atualizar o custo deste ingrediente utilizando o valor da última compra?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (!costUpdatePrompt) return;
                costUpdatePrompt.resolve(false);
                setCostUpdatePrompt(null);
              }}
            >
              Manter custo atual
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                if (!costUpdatePrompt) return;
                costUpdatePrompt.resolve(true);
                setCostUpdatePrompt(null);
              }}
            >
              Atualizar custo
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
