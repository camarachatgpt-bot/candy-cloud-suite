import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { formatDate, formatNumber } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import type { ItemEstoque } from "@/lib/erp/types";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Candy ERP" },
      { name: "description", content: "Controle de insumos, saldos e níveis mínimos de estoque." },
      { property: "og:title", content: "Estoque — Candy ERP" },
      {
        property: "og:description",
        content: "Controle de insumos, saldos e níveis mínimos de estoque.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.estoque()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: EstoquePage,
});

const columns: Column<ItemEstoque>[] = [
  { key: "insumo", header: "Insumo", cell: (i) => <span className="font-medium">{i.insumo}</span> },
  { key: "quantidade", header: "Quantidade", cell: (i) => `${formatNumber(i.quantidade)} ${i.unidade}` },
  { key: "minimo", header: "Mínimo", cell: (i) => `${formatNumber(i.minimo)} ${i.unidade}` },
  { key: "atualizado", header: "Atualizado em", cell: (i) => formatDate(i.atualizado_em) },
];

function EstoquePage() {
  const { data: itens } = useSuspenseQuery(erpQueries.estoque());
  const [open, setOpen] = useState(false);
  const [insumo, setInsumo] = useState("");
  const [quantidade, setQuantidade] = useState("");

  return (
    <>
      <ResourcePage
        title="Estoque"
        description="Controle de insumos, saldos e níveis mínimos."
        columns={columns}
        rows={itens}
        getRowId={(i) => i.id}
        actionLabel="Novo insumo"
        onAction={() => setOpen(true)}
        emptyDescription="Nenhum insumo cadastrado. Os saldos aparecerão aqui."
      />

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Novo insumo"
        description="Cadastro disponível após a conexão com o banco de dados."
        onSubmit={() => {
          toast.info("Banco de dados ainda não conectado.");
          setOpen(false);
        }}
      >
        <FormField id="insumo" label="Insumo" value={insumo} onChange={setInsumo} />
        <FormField
          id="quantidade"
          label="Quantidade"
          type="number"
          value={quantidade}
          onChange={setQuantidade}
        />
      </FormModal>
    </>
  );
}
