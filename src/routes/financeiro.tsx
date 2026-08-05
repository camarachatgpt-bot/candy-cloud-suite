import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import type { Lancamento } from "@/lib/erp/types";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Candy ERP" },
      { name: "description", content: "Contas a pagar, a receber e fluxo de caixa da confeitaria." },
      { property: "og:title", content: "Financeiro — Candy ERP" },
      {
        property: "og:description",
        content: "Contas a pagar, a receber e fluxo de caixa da confeitaria.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.lancamentos()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: FinanceiroPage,
});

const columns: Column<Lancamento>[] = [
  {
    key: "descricao",
    header: "Descrição",
    cell: (l) => <span className="font-medium">{l.descricao}</span>,
  },
  {
    key: "tipo",
    header: "Tipo",
    cell: (l) => (
      <Badge className="rounded-full border-0 bg-primary-soft text-accent-foreground">
        {l.tipo === "receita" ? "Receita" : "Despesa"}
      </Badge>
    ),
  },
  { key: "categoria", header: "Categoria", cell: (l) => l.categoria ?? "—" },
  { key: "vencimento", header: "Vencimento", cell: (l) => formatDate(l.vencimento) },
  { key: "valor", header: "Valor", cell: (l) => formatCurrency(l.valor) },
  { key: "pago", header: "Status", cell: (l) => (l.pago ? "Pago" : "Em aberto") },
];

function FinanceiroPage() {
  const { data: lancamentos } = useSuspenseQuery(erpQueries.lancamentos());
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");

  return (
    <>
      <ResourcePage
        title="Financeiro"
        description="Contas a pagar, a receber e fluxo de caixa."
        columns={columns}
        rows={lancamentos}
        getRowId={(l) => l.id}
        actionLabel="Novo lançamento"
        onAction={() => setOpen(true)}
        emptyDescription="Nenhum lançamento registrado. As movimentações aparecerão aqui."
      />

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Novo lançamento"
        description="Cadastro disponível após a conexão com o banco de dados."
        onSubmit={() => {
          toast.info("Banco de dados ainda não conectado.");
          setOpen(false);
        }}
      >
        <FormField id="descricao" label="Descrição" value={descricao} onChange={setDescricao} />
        <FormField id="valor" label="Valor" type="number" value={valor} onChange={setValor} />
      </FormModal>
    </>
  );
}
