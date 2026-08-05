import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Save, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import { handleErpError } from "@/lib/erp/error-handler";
import type { Cliente, Produto } from "@/lib/erp/types";

export const Route = createFileRoute("/vendas/nova")({
  head: () => ({
    meta: [
      { title: "Registrar Venda — Candy ERP" },
      {
        name: "description",
        content:
          "Registre vendas de cookies em segundos: cliente, plataforma, pagamento, produtos e total.",
      },
      { property: "og:title", content: "Registrar Venda — Candy ERP" },
      {
        property: "og:description",
        content: "Formulário rápido de registro de vendas da confeitaria.",
      },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(erpQueries.clientes());
    void context.queryClient.ensureQueryData(erpQueries.produtos());
    return undefined;
  },
  component: RegistrarVenda,
});

const PLATAFORMAS = [
  { value: "balcao", label: "Balcão", taxa: 0 },
  { value: "whatsapp", label: "WhatsApp", taxa: 0 },
  { value: "ifood", label: "iFood", taxa: 0.23 },
  { value: "99food", label: "99Food", taxa: 0.2 },
  { value: "instagram", label: "Instagram", taxa: 0 },
  { value: "delivery", label: "Delivery próprio", taxa: 0 },
  { value: "site", label: "Site", taxa: 0.03 },
] as const;

const PAGAMENTOS = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credito", label: "Crédito" },
  { value: "debito", label: "Débito" },
] as const;

type Item = {
  id: string;
  produto: string;
  sabor: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
};

const novoItem = (): Item => ({
  id: crypto.randomUUID(),
  produto: "",
  sabor: "",
  quantidade: 1,
  precoUnitario: 0,
  desconto: 0,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RegistrarVenda() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: clientes } = useSuspenseQuery(erpQueries.clientes());
  const { data: produtos } = useSuspenseQuery(erpQueries.produtos());

  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [cliente, setCliente] = useState("");
  const [novoCliente, setNovoCliente] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [plataforma, setPlataforma] = useState("balcao");
  const [pagamento, setPagamento] = useState("pix");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<Item[]>([novoItem()]);

  const saboresDisponiveis = useMemo(
    () => Array.from(new Set(produtos.map((produto) => produto.sabor).filter(Boolean))) as string[],
    [produtos],
  );

  useEffect(() => {
    const agora = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setData(`${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`);
    setHora(`${pad(agora.getHours())}:${pad(agora.getMinutes())}`);
  }, []);

  const atualizarItem = (id: string, patch: Partial<Item>) =>
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const nextItem = { ...item, ...patch };
        const produtoSelecionado = produtos.find((produto) => produto.id === nextItem.produto);

        if (produtoSelecionado && patch.produto) {
          nextItem.precoUnitario = produtoSelecionado.preco_venda;
          if (!nextItem.sabor && produtoSelecionado.sabor) {
            nextItem.sabor = produtoSelecionado.sabor;
          }
        }

        return nextItem;
      }),
    );

  const subtotalItem = (item: Item) =>
    Math.max(item.quantidade * item.precoUnitario - item.desconto, 0);

  const totais = useMemo(() => {
    const bruto = itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0);
    const desconto = itens.reduce((soma, item) => soma + item.desconto, 0);
    const subtotal = Math.max(bruto - desconto, 0);
    const taxaPct = PLATAFORMAS.find((plataformaItem) => plataformaItem.value === plataforma)?.taxa ?? 0;
    const taxa = subtotal * taxaPct;
    const total = Math.max(subtotal - taxa, 0);
    const custoTotal = itens.reduce((soma, item) => {
      const produtoSelecionado = produtos.find((produto) => produto.id === item.produto);
      return soma + item.quantidade * (produtoSelecionado?.custo ?? 0);
    }, 0);
    const lucro = Math.max(subtotal - custoTotal - taxa, 0);

    return { bruto, desconto, subtotal, taxa, taxaPct, total, lucro };
  }, [itens, plataforma, produtos]);

  const resetarFormulario = () => {
    setCliente("");
    setObservacoes("");
    setPlataforma("balcao");
    setPagamento("pix");
    setItens([novoItem()]);

    const agora = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setData(`${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`);
    setHora(`${pad(agora.getHours())}:${pad(agora.getMinutes())}`);
  };

  const createVendaMutation = useMutation({
    mutationFn: async () => {
      const clienteSelecionado = clientes.find((clienteAtual) => clienteAtual.id === cliente);

      if (!clienteSelecionado) {
        throw new Error("Selecione um cliente cadastrado.");
      }

      const itensValidos = itens.filter(
        (item) => item.produto && item.quantidade > 0 && item.precoUnitario >= 0,
      );

      if (itensValidos.length === 0) {
        throw new Error("Adicione ao menos um produto válido.");
      }

      const itensPayload = itensValidos.map((item) => {
        const produtoSelecionado = produtos.find((produto) => produto.id === item.produto);

        if (!produtoSelecionado) {
          throw new Error("Selecione um produto válido para cada item.");
        }

        return {
          produto_id: item.produto,
          produto_nome: produtoSelecionado.nome,
          sabor: item.sabor || produtoSelecionado.sabor || null,
          quantidade: item.quantidade,
          preco_unitario: item.precoUnitario,
          desconto: item.desconto,
          subtotal: Math.max(item.quantidade * item.precoUnitario - item.desconto, 0),
        };
      });

      const numero = `VN-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
      const dataVenda = `${data}T${hora || "00:00"}:00`;
      const itensResumo = itensPayload
        .map((item) => `${item.produto_nome} x ${item.quantidade}`)
        .join(" | ");

      const payload = {
        numero,
        cliente_id: clienteSelecionado.id,
        cliente_nome: clienteSelecionado.nome,
        plataforma: plataforma as (typeof PLATAFORMAS)[number]["value"],
        forma_pagamento: pagamento as (typeof PAGAMENTOS)[number]["value"],
        subtotal: totais.subtotal,
        desconto: totais.desconto,
        taxa_plataforma: totais.taxa,
        total: totais.total,
        lucro_estimado: totais.lucro,
        observacoes: [observacoes.trim(), itensResumo].filter(Boolean).join(" | ") || null,
        data_venda: dataVenda,
        itens: itensPayload,
      };

      return erpRepository.createVenda(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendas"] });
      await queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      await queryClient.invalidateQueries({ queryKey: ["estoque"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      await queryClient.invalidateQueries({ queryKey: ["receitas"] });
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      await queryClient.invalidateQueries({ queryKey: ["financeiro", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "resumo"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["custos-fixos", "dashboard"] });
      toast.success("Venda registrada com sucesso.");
      resetarFormulario();
      navigate({ to: "/vendas" });
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "registrar",
        context: { module: "vendas" },
        fallback: "Não foi possível registrar a venda.",
      });
    },
  });

  const createClienteMutation = useMutation({
    mutationFn: (payload: {
      nome: string;
      telefone: string | null;
      email: string | null;
      cidade: string | null;
    }) => erpRepository.createCliente(payload),
    onSuccess: async (clienteCriado) => {
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setCliente(clienteCriado.id);
      setNovoCliente("");
      setDialogAberto(false);
      toast.success("Cliente cadastrado com sucesso.");
    },
    onError: (error: Error) => {
      handleErpError(error, {
        action: "cadastrar",
        context: { module: "clientes" },
        fallback: "Não foi possível cadastrar o cliente.",
      });
    },
  });

  const salvar = () => {
    createVendaMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Registrar Venda"
        description="Preencha em segundos. Registre pedidos com cliente, plataforma, pagamento e itens."
        actions={
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link to="/vendas" aria-label="Fechar">
              <X className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Dados da venda</CardTitle>
          <CardDescription>Data e hora preenchidas automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hora">Hora</Label>
            <Input
              id="hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Cliente</Label>
            <div className="flex gap-2">
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger className="min-w-0 flex-1 rounded-xl">
                  <SelectValue placeholder="Selecionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((clienteAtual: Cliente) => (
                    <SelectItem key={clienteAtual.id} value={clienteAtual.id}>
                      {clienteAtual.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 rounded-xl"
                aria-label="Cadastrar novo cliente"
                onClick={() => setDialogAberto(true)}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={plataforma} onValueChange={setPlataforma}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATAFORMAS.map((plataformaItem) => (
                  <SelectItem key={plataformaItem.value} value={plataformaItem.value}>
                    {plataformaItem.label}
                    {plataformaItem.taxa > 0 ? ` · taxa ${Math.round(plataformaItem.taxa * 100)}%` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={pagamento} onValueChange={setPagamento}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGAMENTOS.map((pagamentoItem) => (
                  <SelectItem key={pagamentoItem.value} value={pagamentoItem.value}>
                    {pagamentoItem.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base">Produtos</CardTitle>
            <CardDescription>Adicione quantos itens quiser.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-xl"
            onClick={() => setItens((prev) => [...prev, novoItem()])}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {itens.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border/70 bg-muted/30 p-4 transition-colors hover:bg-muted/50"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Item {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                  aria-label={`Remover item ${index + 1}`}
                  disabled={itens.length === 1}
                  onClick={() => setItens((prev) => prev.filter((itemAtual) => itemAtual.id !== item.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Produto</Label>
                  <Select
                    value={item.produto}
                    onValueChange={(value) => atualizarItem(item.id, { produto: value })}
                  >
                    <SelectTrigger className="w-full rounded-xl bg-background">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.map((produto: Produto) => (
                        <SelectItem key={produto.id} value={produto.id}>
                          {produto.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sabor</Label>
                  <Select
                    value={item.sabor}
                    onValueChange={(value) => atualizarItem(item.id, { sabor: value })}
                  >
                    <SelectTrigger className="w-full rounded-xl bg-background">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {saboresDisponiveis.map((sabor) => (
                        <SelectItem key={sabor} value={sabor}>
                          {sabor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Qtd.</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) =>
                      atualizarItem(item.id, { quantidade: Number(e.target.value) || 0 })
                    }
                    className="rounded-xl bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço un.</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.precoUnitario}
                    onChange={(e) =>
                      atualizarItem(item.id, { precoUnitario: Number(e.target.value) || 0 })
                    }
                    className="rounded-xl bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.desconto}
                    onChange={(e) =>
                      atualizarItem(item.id, { desconto: Number(e.target.value) || 0 })
                    }
                    className="rounded-xl bg-background"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{brl(subtotalItem(item))}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
            <CardDescription>Detalhes de entrega, embalagem ou recado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: entregar até as 15h, embalar para presente..."
              className="min-h-[132px] rounded-xl"
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
            <CardDescription>Cálculo automático da venda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{brl(totais.bruto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Desconto</span>
              <span className="font-medium text-destructive">− {brl(totais.desconto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Taxa da plataforma ({Math.round(totais.taxaPct * 100)}%)
              </span>
              <span className="font-medium text-destructive">− {brl(totais.taxa)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold tracking-tight">{brl(totais.total)}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-primary-soft px-3 py-2">
              <span className="text-accent-foreground">Lucro estimado</span>
              <span className="font-semibold text-accent-foreground">{brl(totais.lucro)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => navigate({ to: "/vendas" })}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className="rounded-xl shadow-[var(--shadow-glow)]"
          onClick={salvar}
          disabled={createVendaMutation.isPending}
        >
          <Save className="h-4 w-4" />
          Salvar Venda
        </Button>
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>Cadastre o cliente e ele será listado no Select após a atualização.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="novo-cliente">Nome</Label>
            <Input
              id="novo-cliente"
              value={novoCliente}
              onChange={(e) => setNovoCliente(e.target.value)}
              placeholder="Ex.: Cafeteria da Esquina"
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDialogAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={createClienteMutation.isPending}
              onClick={() => {
                const nome = novoCliente.trim();

                if (!nome) {
                  toast.error("Informe o nome do cliente.");
                  return;
                }

                createClienteMutation.mutate({
                  nome,
                  telefone: null,
                  email: null,
                  cidade: null,
                });
              }}
            >
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
