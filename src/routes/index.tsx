import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Cookie, DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";

import { EmptyState } from "@/components/erp/empty-state";
import { StatCard } from "@/components/erp/stat-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, formatNumber } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Candy ERP" },
      {
        name: "description",
        content: "Visão geral da confeitaria: faturamento, lucro, pedidos e metas do mês.",
      },
      { property: "og:title", content: "Dashboard — Candy ERP" },
      {
        property: "og:description",
        content: "Faturamento, pedidos, estoque e metas da sua confeitaria em um só lugar.",
      },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(erpQueries.vendas());
    void context.queryClient.ensureQueryData(erpQueries.clientes());
    void context.queryClient.ensureQueryData(erpQueries.produtos());
    void context.queryClient.ensureQueryData(erpQueries.dashboardTopProdutos());
    return context.queryClient.ensureQueryData(erpQueries.resumoDashboard());
  },
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: Dashboard,
});

function Dashboard() {
  const { data: resumo } = useSuspenseQuery(erpQueries.resumoDashboard());
  const { data: vendas } = useSuspenseQuery(erpQueries.vendas());
  const { data: produtos } = useSuspenseQuery(erpQueries.produtos());
  const { data: clientes } = useSuspenseQuery(erpQueries.clientes());
  const { data: topProdutos } = useSuspenseQuery(erpQueries.dashboardTopProdutos());

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Dashboard"
        description="Visão geral da operação da confeitaria."
        actions={
          <Button asChild className="rounded-xl shadow-[var(--shadow-glow)]">
            <Link to="/vendas/nova">
              Registrar Venda
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Faturamento Hoje"
          value={formatCurrency(resumo.faturamento_hoje)}
          icon={DollarSign}
        />
        <StatCard label="Lucro Hoje" value={formatCurrency(resumo.lucro_hoje)} icon={TrendingUp} />
        <StatCard
          label="Pedidos Hoje"
          value={formatNumber(resumo.pedidos_hoje)}
          icon={ShoppingCart}
        />
        <StatCard
          label="Cookies Vendidos Hoje"
          value={formatNumber(resumo.cookies_hoje)}
          icon={Cookie}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/70 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pedidos recentes</CardTitle>
            <CardDescription>Últimas vendas registradas.</CardDescription>
          </CardHeader>
          <CardContent>
            {vendas.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                description="Nenhuma venda registrada ainda."
                action={
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link to="/vendas/nova">Registrar venda</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {vendas.slice(0, 5).map((venda) => (
                  <div
                    key={venda.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{venda.numero}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(venda.data_venda)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(venda.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {venda.cliente_nome ?? "Cliente sem nome"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Top cookies</CardTitle>
            <CardDescription>Unidades vendidas no mês</CardDescription>
          </CardHeader>
          <CardContent>
            {topProdutos.length === 0 || produtos.length === 0 ? (
              <EmptyState icon={Cookie} description="Sem dados de vendas por produto." />
            ) : (
              <div className="space-y-2">
                {topProdutos.map((produto) => (
                  <div
                    key={produto.nome}
                    className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span>{produto.nome}</span>
                    <span className="font-medium">{formatNumber(produto.unidades)} un.</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardDescription>Meta mensal</CardDescription>
            <CardTitle className="text-2xl">{resumo.meta_mensal_percentual}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={resumo.meta_mensal_percentual} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {formatCurrency(resumo.meta_mensal_realizado)} de{" "}
              {formatCurrency(resumo.meta_mensal_alvo)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardDescription>Estoque crítico</CardDescription>
            <CardTitle className="text-2xl">{resumo.estoque_critico} itens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>Clientes cadastrados</span>
              <span className="font-semibold text-foreground">{formatNumber(clientes.length)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Produtos cadastrados</span>
              <span className="font-semibold text-foreground">{formatNumber(produtos.length)}</span>
            </div>
          </CardContent>
        </Card>
        <Card
          className="rounded-2xl border-0 text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/80">Ticket médio</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(resumo.ticket_medio)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-primary-foreground/80">Sem dados</CardContent>
        </Card>
      </div>
    </div>
  );
}
