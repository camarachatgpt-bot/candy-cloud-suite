import { useEffect } from "react";

import { handleErpError } from "./error-handler";

export function ErpRouteError({
  error,
  context,
}: {
  error?: unknown;
  context?: Record<string, unknown>;
}) {
  useEffect(() => {
    handleErpError(error ?? new Error("Erro inesperado ao carregar a página."), {
      action: "registrar",
      fallback: "Ocorreu um erro interno. Tente novamente.",
      context: { boundary: "route_error", ...(context ?? {}) },
      silent: true,
    });
  }, [context, error]);

  return (
    <div role="alert" className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
      Ocorreu um erro interno. Tente novamente.
    </div>
  );
}
