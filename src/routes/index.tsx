import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Cookie,
  DollarSign,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Candy ERP" },
      {
        name: "description",
        content:
          "Visão geral da confeitaria: faturamento, pedidos, produção de cookies e metas do mês.",
      },
      { property: "og:title", content: "Dashboard — Candy ERP" },
      {
        property: "og:description",
        content: "Faturamento, pedidos, estoque e metas da sua confeitaria em um só lugar.",
      },
    ],
  }),
  component: Dashboard,
});

const kpis = [
  { label: "Faturamento Hoje", value: "R$ 3.280", delta: "+12,4%", icon: DollarSign },
  { label: "Lucro Hoje", value: "R$ 1.804", delta: "+9,8%", icon: TrendingUp },
  { label: "Pedidos Hoje", value: "42", delta: "+8,1%", icon: ShoppingCart },
  { label: "Cookies Vendidos Hoje", value: "1.560", delta: "+5,7%", icon: Cookie },
];

const topProdutos = [
  { nome: "Cookie Belga 90g", vendas: 4210, share: 92 },
  { nome: "Red Velvet Recheado", vendas: 3180, share: 74 },
  { nome: "Duplo Chocolate", vendas: 2740, share: 63 },
  { nome: "Pistache Premium", vendas: 1890, share: 45 },
  { nome: "Nutella Lovers", vendas: 1320, share: 32 },
];

const pedidos = [
  { id: "#CK-1042", cliente: "Café Aurora", valor: "R$ 1.240", status: "Pago" },
  { id: "#CK-1041", cliente: "Mercado Bom Dia", valor: "R$ 780", status: "Em produção" },
  { id: "#CK-1040", cliente: "Julia Ferraz", valor: "R$ 156", status: "Enviado" },
  { id: "#CK-1039", cliente: "Padaria Estrela", valor: "R$ 2.310", status: "Pago" },
  { id: "#CK-1038", cliente: "Doce Ponto", valor: "R$ 430", status: "Pendente" },
];

const statusVariant: Record<string, string> = {
  Pago: "bg-success/15 text-success",
  "Em produção": "bg-warning/15 text-warning",
  Enviado: "bg-primary-soft text-accent-foreground",
  Pendente: "bg-muted text-muted-foreground",
};

function Dashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Dashboard"
        description="Resumo fictício de demonstração da operação da confeitaria."
        actions={
          <Button className="rounded-xl shadow-[var(--shadow-glow)]">
            Novo pedido
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className="rounded-2xl border-border/70 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription className="truncate">{kpi.label}</CardDescription>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-accent-foreground">
                <kpi.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-success">
                <TrendingUp className="h-3 w-3" />
                {kpi.delta} vs. mês anterior
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/70 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pedidos recentes</CardTitle>
            <CardDescription>Dados fictícios para demonstração visual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {pedidos.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.cliente}</p>
                  <p className="text-xs text-muted-foreground">{p.id}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold">{p.valor}</span>
                  <Badge className={`rounded-full border-0 ${statusVariant[p.status]}`}>
                    {p.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Top cookies</CardTitle>
            <CardDescription>Unidades vendidas no mês</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topProdutos.map((p) => (
              <div key={p.nome} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{p.nome}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{p.vendas}</span>
                </div>
                <Progress value={p.share} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardDescription>Meta mensal</CardDescription>
            <CardTitle className="text-2xl">78%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={78} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">R$ 84.320 de R$ 108.000</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardDescription>Estoque crítico</CardDescription>
            <CardTitle className="text-2xl">4 itens</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-4 w-4" /> Chocolate belga, pistache, manteiga, nozes
          </CardContent>
        </Card>
        <Card
          className="rounded-2xl border-0 text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/80">Ticket médio</CardDescription>
            <CardTitle className="text-2xl">R$ 65,70</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-primary-foreground/80">
            +9,3% em relação ao trimestre anterior
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
