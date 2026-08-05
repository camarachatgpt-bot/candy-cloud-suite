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

const PAGAMENTOS = ["Pix", "Dinheiro", "Cartão de Crédito", "Cartão de Débito"] as const;

const PRODUTOS = ["Cookie 90g", "Cookie 120g", "Caixa com 4", "Caixa com 8", "Brownie"] as const;
const SABORES = [
  "Belga",
  "Duplo Chocolate",
  "Red Velvet",
  "Pistache",
  "Nutella",
  "Doce de Leite",
] as const;

const CLIENTES_INICIAIS = [
  "Café Aurora",
  "Mercado Bom Dia",
  "Padaria Estrela",
  "Doce Ponto",
  "Julia Ferraz",
];

// margem de custo estimada sobre o valor bruto dos produtos
const CUSTO_ESTIMADO = 0.45;

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
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [cliente, setCliente] = useState("");
  const [clientes, setClientes] = useState(CLIENTES_INICIAIS);
  const [novoCliente, setNovoCliente] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [plataforma, setPlataforma] = useState("balcao");
  const [pagamento, setPagamento] = useState("Pix");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<Item[]>([novoItem()]);

  useEffect(() => {
    const agora = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setData(`${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`);
    setHora(`${pad(agora.getHours())}:${pad(agora.getMinutes())}`);
  }, []);

  const atualizarItem = (id: string, patch: Partial<Item>) =>
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const subtotalItem = (i: Item) =>
    Math.max(i.quantidade * i.precoUnitario - i.desconto, 0);

  const totais = useMemo(() => {
    const bruto = itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
    const desconto = itens.reduce((s, i) => s + i.desconto, 0);
    const subtotal = Math.max(bruto - desconto, 0);
    const taxaPct = PLATAFORMAS.find((p) => p.value === plataforma)?.taxa ?? 0;
    const taxa = subtotal * taxaPct;
    const total = subtotal - taxa;
    const lucro = total - bruto * CUSTO_ESTIMADO;
    return { bruto, desconto, subtotal, taxa, taxaPct, total, lucro };
  }, [itens, plataforma]);

  const salvar = () => {
    if (!cliente) return toast.error("Selecione um cliente.");
    if (!itens.some((i) => i.produto && i.quantidade > 0))
      return toast.error("Adicione ao menos um produto.");
    toast.success("Venda registrada (demonstração)", {
      description: `${cliente} · ${brl(totais.total)}`,
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Registrar Venda"
        description="Preencha em segundos. Nenhum dado é salvo ainda — apenas interface."
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
                  {clientes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
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
                {PLATAFORMAS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                    {p.taxa > 0 ? ` · taxa ${Math.round(p.taxa * 100)}%` : ""}
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
                {PAGAMENTOS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
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
                  onClick={() => setItens((prev) => prev.filter((i) => i.id !== item.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Produto</Label>
                  <Select
                    value={item.produto}
                    onValueChange={(v) => atualizarItem(item.id, { produto: v })}
                  >
                    <SelectTrigger className="w-full rounded-xl bg-background">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUTOS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sabor</Label>
                  <Select
                    value={item.sabor}
                    onValueChange={(v) => atualizarItem(item.id, { sabor: v })}
                  >
                    <SelectTrigger className="w-full rounded-xl bg-background">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {SABORES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
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
        <Button type="button" className="rounded-xl shadow-[var(--shadow-glow)]" onClick={salvar}>
          <Save className="h-4 w-4" />
          Salvar Venda
        </Button>
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>
              O cliente ficará disponível nesta sessão de demonstração.
            </DialogDescription>
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
              onClick={() => {
                const nome = novoCliente.trim();
                if (!nome) return;
                setClientes((prev) => (prev.includes(nome) ? prev : [...prev, nome]));
                setCliente(nome);
                setNovoCliente("");
                setDialogAberto(false);
                toast.success("Cliente adicionado");
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
