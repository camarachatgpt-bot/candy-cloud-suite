export function normalizarStatusParaDb(status: string | null | undefined, tipo: "pagar" | "receber"): string {
  const valor = status?.trim();

  if (!valor) {
    return "Pendente";
  }

  const statusNormalizado = valor.toLowerCase();

  if (statusNormalizado === "pago") {
    return "Pago";
  }

  if (statusNormalizado === "recebido") {
    return "Recebido";
  }

  if (statusNormalizado === "parcial") {
    return "Parcial";
  }

  if (statusNormalizado === "vencido" || statusNormalizado === "atrasado") {
    return "Vencido";
  }

  if (statusNormalizado === "cancelado") {
    return "Pendente";
  }

  if (statusNormalizado === "aberto" || statusNormalizado === "pendente") {
    return "Pendente";
  }

  return tipo === "receber" ? "Pendente" : "Pendente";
}
