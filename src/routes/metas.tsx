import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import type { Meta } from "@/lib/erp/types";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Candy ERP" },
      { name: "description", content: "Metas de faturamento, produção e acompanhamento mensal." },
      { property: "og:title", content: "Metas — Candy ERP" },
      {
        property: "og:description",
        content: "Metas de faturamento, produção e acompanhamento mensal.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.metas()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: MetasPage,
});

const columns: Column<Meta>[] = [
  { key: "titulo", header: "Meta", cell: (m) => <span className="font-medium">{m.titulo}</span> },
  { key: "periodo", header: "Período", cell: (m) => m.periodo },
  { key: "alvo", header: "Alvo", cell: (m) => formatCurrency(m.alvo) },
  { key: "realizado", header: "Realizado", cell: (m) => formatCurrency(m.realizado) },
  {
    key: "progresso",
    header: "Progresso",
    cell: (m) => (
      <Progress value={m.alvo > 0 ? (m.realizado / m.alvo) * 100 : 0} className="h-2 w-32" />
    ),
  },
];

function MetasPage() {
  const { data: metas } = useSuspenseQuery(erpQueries.metas());
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [alvo, setAlvo] = useState("");

  return (
    <>
      <ResourcePage
        title="Metas"
        description="Metas de faturamento, produção e acompanhamento mensal."
        columns={columns}
        rows={metas}
        getRowId={(m) => m.id}
        actionLabel="Nova meta"
        onAction={() => setOpen(true)}
        emptyDescription="Nenhuma meta definida. As metas aparecerão aqui."
      />

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Nova meta"
        description="Cadastro disponível após a conexão com o banco de dados."
        onSubmit={() => {
          toast.info("Banco de dados ainda não conectado.");
          setOpen(false);
        }}
      >
        <FormField id="titulo" label="Título" value={titulo} onChange={setTitulo} />
        <FormField id="alvo" label="Alvo (R$)" type="number" value={alvo} onChange={setAlvo} />
      </FormModal>
    </>
  );
}
