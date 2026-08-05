import { toast } from "sonner";

import { reportLovableError } from "@/lib/lovable-error-reporting";

type ErrorAction =
  | "salvar"
  | "atualizar"
  | "excluir"
  | "registrar"
  | "cadastrar"
  | "reabrir"
  | "marcar"
  | "processar";

const DEFAULT_FRIENDLY_MESSAGES: Record<ErrorAction, string> = {
  salvar: "Não foi possível salvar o registro.",
  atualizar: "Não foi possível atualizar o cadastro.",
  excluir: "Não foi possível excluir o registro.",
  registrar: "Ocorreu um erro interno. Tente novamente.",
  cadastrar: "Não foi possível salvar o registro.",
  reabrir: "Não foi possível atualizar o cadastro.",
  marcar: "Não foi possível atualizar o cadastro.",
  processar: "Ocorreu um erro interno. Tente novamente.",
};

function isFriendlyErrorMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();

  return (
    normalized.includes("não é possível") ||
    normalized.includes("não foi possível") ||
    normalized.includes("informe") ||
    normalized.includes("preencha") ||
    normalized.includes("não pode") ||
    normalized.includes("vinculado") ||
    normalized.includes("vinculada") ||
    normalized.includes("movimentações")
  );
}

export function handleErpError(
  error: unknown,
  options: {
    action?: ErrorAction;
    fallback?: string;
    context?: Record<string, unknown>;
    silent?: boolean;
  } = {},
) {
  const action = options.action ?? "processar";
  const fallback = options.fallback ?? DEFAULT_FRIENDLY_MESSAGES[action];
  const message = error instanceof Error && isFriendlyErrorMessage(error.message) ? error.message : fallback;

  console.error("[Candy ERP] Erro na operação", {
    action,
    ...(options.context ?? {}),
    error,
  });

  reportLovableError(error, {
    source: "erp_mutation",
    action,
    ...(options.context ?? {}),
  });

  if (!options.silent) {
    toast.error(message);
  }

  return message;
}
