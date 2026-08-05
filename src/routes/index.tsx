import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Cookie,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { DashboardPanelCard } from "@/components/erp/dashboard-panel-card";
import { EmptyState } from "@/components/erp/empty-state";
import { StatCard } from "@/components/erp/stat-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, formatNumber } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { ErpRouteError } from "@/lib/erp/route-error";

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
    void context.queryClient.ensureQueryData(erpQueries.custosFixos());
    void context.queryClient.ensureQueryData(erpQueries.contasPagar());
    void context.queryClient.ensureQueryData(erpQueries.dashboardTopProdutos());
    void context.queryClient.ensureQueryData(erpQueries.dashboardAlertas());
    return context.queryClient.ensureQueryData(erpQueries.resumoDashboard());
  },
  errorComponent: ({ error }) => <ErpRouteError error={error} context={{ module: "dashboard" }} />,
  component: Dashboard,
});

function Dashboard() {
  const { data: resumo } = useSuspenseQuery(erpQueries.resumoDashboard());
  const { data: vendas } = useSuspenseQuery(erpQueries.vendas());
  const { data: produtos } = useSuspenseQuery(erpQueries.produtos());
  const { data: clientes } = useSuspenseQuery(erpQueries.clientes());
  const { data: custosFixos } = useSuspenseQuery(erpQueries.custosFixos());
  const { data: contasPagar } = useSuspenseQuery(erpQueries.contasPagar());
  const { data: topProdutos } = useSuspenseQuery(erpQueries.dashboardTopProdutos());
  const { data: alertas } = useSuspenseQuery(erpQueries.dashboardAlertas());

  const custosFixosAtivos = custosFixos.filter((custo) => custo.status === "Ativo");
  const custosFixosJaPagos = new Set(
    contasPagar
      .filter((conta) => conta.documento?.startsWith("custo-fixo:") && (conta.status === "Pago" || conta.status === "Parcial"))
      .map((conta) => conta.documento?.replace("custo-fixo:", "") ?? ""),
  );
  const totalCustosFixosMes = custosFixosAtivos.reduce((total, custo) => total + custo.valor_mensal, 0);
  const valorPago = contasPagar
    .filter((conta) => conta.documento?.startsWith("custo-fixo:") && (conta.status === "Pago" || conta.status === "Parcial"))
    .reduce((total, conta) => total + Number(conta.valor_pago ?? conta.valor_total ?? 0), 0);
  const valorPendente = Math.max(totalCustosFixosMes - valorPago, 0);
  const custosFixosPendentes = custosFixosAtivos.filter((custo) => !custosFixosJaPagos.has(custo.id)).length;
  const proximoVencimento = [...custosFixosAtivos]
    .filter((custo) => custo.data_vencimento && !custosFixosJaPagos.has(custo.id))
    .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""))[0];

  const produtoMaisLucrativo = resumo.produto_mais_lucrativo;
  const produtoMaisAbaixoDoMinimo = resumo.produto_mais_abaixo_do_minimo;
  const destaquePrincipal = resumo.caixa_disponivel >= 0 ? "Caixa disponível" : "Resultado do dia";

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

      <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">Alertas da operação</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {alertas.map((alerta) => (
            <Link
              key={alerta.id}
              to={alerta.link}
              className="rounded-full border border-border/60 bg-background px-3 py-2 text-sm shadow-sm transition hover:border-primary/40 hover:text-primary"
            >
              <span className="mr-2 text-xs uppercase text-muted-foreground">{alerta.tipo}</span>
              {alerta.titulo}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Receita Hoje" value={formatCurrency(resumo.faturamento_hoje)} icon={DollarSign} />
        <StatCard label="Lucro Operacional Hoje" value={formatCurrency(resumo.lucro_hoje)} icon={TrendingUp} />
        <StatCard label="Pedidos Hoje" value={formatNumber(resumo.pedidos_hoje)} icon={ShoppingCart} />
        <StatCard label="Ticket Médio" value={formatCurrency(resumo.ticket_medio)} icon={CircleDollarSign} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contas a Receber" value={formatCurrency(resumo.contas_a_receber)} icon={Wallet} hint="Valores em aberto" />
        <StatCard label="Contas a Pagar" value={formatCurrency(resumo.contas_a_pagar)} icon={ClipboardList} hint="Valores pendentes" />
        <StatCard label="Caixa Disponível" value={formatCurrency(resumo.caixa_disponivel)} icon={Building2} hint="Recebimentos menos pagamentos" />
        <StatCard label="Ingredientes em Estoque Crítico" value={formatNumber(resumo.estoque_critico)} icon={Package} hint="Itens ativos abaixo do mínimo" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <DashboardPanelCard title="Produto Mais Vendido" description="Top do catálogo" className="lg:col-span-1">
          <div className="space-y-2">
            <p className="text-lg font-semibold">{topProdutos[0]?.nome ?? "Sem dados"}</p>
            <p className="text-sm text-muted-foreground">
              {topProdutos[0] ? `${formatNumber(topProdutos[0].unidades)} unidades` : "Cadastre vendas para gerar o ranking."}
            </p>
          </div>
        </DashboardPanelCard>

        <DashboardPanelCard title="Produto Mais Lucrativo" description="Maior margem" className="lg:col-span-1">
          <div className="space-y-2">
            <p className="text-lg font-semibold">{produtoMaisLucrativo?.nome ?? "Sem dados"}</p>
            <p className="text-sm text-muted-foreground">
              {produtoMaisLucrativo ? `${produtoMaisLucrativo.margem.toFixed(1)}% de margem` : "Cadastre preços e custos para comparar."}
            </p>
          </div>
        </DashboardPanelCard>

        <DashboardPanelCard title="Margem Média" description="Rentabilidade consolidada">
          <p className="text-2xl font-semibold">{resumo.margem_media_produtos.toFixed(1)}%</p>
        </DashboardPanelCard>

        <DashboardPanelCard title="Meta Mensal" description="Progresso do mês">
          <div className="space-y-2">
            <p className="text-2xl font-semibold">{resumo.meta_mensal_percentual}%</p>
            <Progress value={resumo.meta_mensal_percentual} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {formatCurrency(resumo.meta_mensal_realizado)} de {formatCurrency(resumo.meta_mensal_alvo)}
            </p>
          </div>
        </DashboardPanelCard>

        <DashboardPanelCard title="Custo Fixo do Mês" description="Resumo do mês" className="lg:col-span-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>Total do mês</span>
              <span className="font-semibold text-foreground">{formatCurrency(totalCustosFixosMes)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Já pago</span>
              <span className="font-semibold text-foreground">{formatCurrency(valorPago)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Pendente</span>
              <span className="font-semibold text-foreground">{formatCurrency(valorPendente)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Pendentes</span>
              <span className="font-semibold text-foreground">{formatNumber(custosFixosPendentes)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Próximo vencimento</span>
              <span className="font-semibold text-foreground">
                {proximoVencimento ? formatDate(proximoVencimento.data_vencimento ?? "") : "—"}
              </span>
            </div>
            <Button asChild variant="outline" className="mt-2 w-full rounded-xl">
              <Link to="/custos-fixos">Ver todos</Link>
            </Button>
          </div>
        </DashboardPanelCard>
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

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <DashboardPanelCard title="Destaque executivo" description="Indicador prioritário do dia">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground">{destaquePrincipal}</p>
              <p className="text-2xl font-semibold">{formatCurrency(resumo.caixa_disponivel)}</p>
            </div>
            <div className="rounded-xl bg-primary-soft p-3 text-accent-foreground">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </DashboardPanelCard>

        <DashboardPanelCard title="Resumo operacional" description="Base para decisão">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>Clientes cadastrados</span>
              <span className="font-semibold text-foreground">{formatNumber(clientes.length)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Produtos cadastrados</span>
              <span className="font-semibold text-foreground">{formatNumber(produtos.length)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Pedidos hoje</span>
              <span className="font-semibold text-foreground">{formatNumber(resumo.pedidos_hoje)}</span>
            </div>
          </div>
        </DashboardPanelCard>
      </div>
    </div>
  );
}
