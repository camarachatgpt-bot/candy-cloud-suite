import { QueryClientProvider, useQuery, type QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Bell, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
import { handleErpError } from "@/lib/erp/error-handler";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#ec4899" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Candy ERP" },
      { title: "Candy ERP — Gestão para confeitaria de cookies" },
      {
        name: "description",
        content:
          "ERP moderno para confeitarias de cookies gourmet: produtos, estoque, vendas, financeiro e metas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <RootContent />
    </QueryClientProvider>
  );
}

function RootContent() {
  const { queryClient } = Route.useRouteContext();
  const [panelOpen, setPanelOpen] = useState(false);
  const notificationsQuery = useQuery(erpQueries.notificacoes());

  const notificacoes = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);
  const naoLidas = useMemo(() => notificacoes.filter((item) => !item.lida).length, [notificacoes]);
  const [toastShown, setToastShown] = useState(false);

  useEffect(() => {
    if (toastShown || notificationsQuery.isLoading || notificationsQuery.isFetching) {
      return;
    }

    const alertas = notificacoes.filter((item) => !item.lida);

    if (alertas.length > 0) {
      setToastShown(true);
      toast.warning(`Você tem ${alertas.length} alerta${alertas.length > 1 ? "s" : ""} financeiro${alertas.length > 1 ? "s" : ""} pendente${alertas.length > 1 ? "s" : ""}.`, {
        description: "Abra as notificações para revisar vencimentos e pendências.",
      });
    }
  }, [notificationsQuery.isFetching, notificationsQuery.isLoading, notificacoes, toastShown]);

  const handleMarcarTodasLidas = async () => {
    try {
      await erpRepository.marcarNotificacoesComoLidas();
      await queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      toast.success("Notificações marcadas como lidas.");
    } catch (error) {
      handleErpError(error, {
        action: "marcar",
        context: { module: "notificacoes" },
        fallback: "Não foi possível atualizar as notificações.",
      });
    }
  };

  return (
    <>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background font-sans">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
              <SidebarTrigger className="rounded-lg" />
              <div className="relative hidden min-w-0 flex-1 sm:block">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos, pedidos, clientes..."
                  className="h-10 max-w-md rounded-xl pl-9"
                />
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notificações" onClick={() => setPanelOpen(true)}>
                  <Bell className="h-4 w-4" />
                  {naoLidas > 0 ? <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">{naoLidas}</span> : null}
                </Button>
                <ThemeToggle />
                <Avatar className="ml-1 h-9 w-9">
                  <AvatarFallback className="bg-primary-soft text-xs font-semibold text-accent-foreground">
                    CE
                  </AvatarFallback>
                </Avatar>
              </div>
            </header>
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Notificações</SheetTitle>
            <SheetDescription>Hoje, vencendo em breve e pendências não lidas.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
              <span className="text-sm font-medium">{naoLidas} não lidas</span>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={handleMarcarTodasLidas}>Marcar todas como lidas</Button>
            </div>
            {notificacoes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">Nenhuma notificação no momento.</p>
            ) : (
              notificacoes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() => {
                    if (item.link) {
                      window.location.assign(item.link);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.titulo}</p>
                    <span className="text-[11px] uppercase text-muted-foreground">{item.prioridade}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.descricao}</p>
                  {item.valor ? <p className="mt-2 text-xs font-medium text-foreground">Valor: R$ {Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p> : null}
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(item.data).toLocaleDateString("pt-BR")}</p>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Toaster position="top-right" richColors />
    </>
  );
}

