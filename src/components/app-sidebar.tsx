import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  Cookie,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Target,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const operacao = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Produtos", url: "/produtos", icon: Cookie },
  { title: "Ingredientes", url: "/ingredientes", icon: Package },
  { title: "Receitas", url: "/receitas", icon: Package },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Compras", url: "/compras", icon: ShoppingCart },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
] as const;

const relacionamento = [
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
] as const;

const gestao = [
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Custos Fixos", url: "/custos-fixos", icon: Wallet },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Inteligência", url: "/inteligencia", icon: Bot },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const renderGroup = (
    label: string,
    items: ReadonlyArray<{ title: string; url: string; icon: typeof Cookie }>,
  ) => (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-[11px] font-semibold tracking-widest uppercase">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={pathname === item.url}
                className="rounded-xl transition-all duration-200 data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground"
              >
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="px-3 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Cookie className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">Candy ERP</p>
              <p className="truncate text-xs text-muted-foreground">Cookies gourmet</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {renderGroup("Operação", operacao)}
        {renderGroup("Relacionamento", relacionamento)}
        {renderGroup("Gestão", gestao)}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="rounded-xl bg-primary-soft p-3">
            <p className="text-xs font-semibold text-accent-foreground">Plano Pro</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Dados de demonstração ativos.
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
