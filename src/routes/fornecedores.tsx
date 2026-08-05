import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import type { Fornecedor } from "@/lib/erp/types";

export const Route = createFileRoute("/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — Candy ERP" },
      { name: "description", content: "Cadastro de fornecedores de insumos e embalagens." },
      { property: "og:title", content: "Fornecedores — Candy ERP" },
      {
        property: "og:description",
        content: "Cadastro de fornecedores de insumos e embalagens.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.fornecedores()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: FornecedoresPage,
});

const columns: Column<Fornecedor>[] = [
  { key: "nome", header: "Fornecedor", cell: (f) => <span className="font-medium">{f.nome}</span> },
  { key: "contato", header: "Contato", cell: (f) => f.contato ?? "—" },
  { key: "categoria", header: "Categoria", cell: (f) => f.categoria ?? "—" },
  { key: "created_at", header: "Cadastro", cell: (f) => formatDate(f.created_at) },
];

function FornecedoresPage() {
  const { data: fornecedores } = useSuspenseQuery(erpQueries.fornecedores());
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");

  return (
    <>
      <ResourcePage
        title="Fornecedores"
        description="Cadastro de fornecedores de insumos e embalagens."
        columns={columns}
        rows={fornecedores}
        getRowId={(f) => f.id}
        actionLabel="Novo fornecedor"
        onAction={() => setOpen(true)}
        emptyDescription="Nenhum fornecedor cadastrado. Os fornecedores aparecerão aqui."
      />

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Novo fornecedor"
        description="Cadastro disponível após a conexão com o banco de dados."
        onSubmit={() => {
          toast.info("Banco de dados ainda não conectado.");
          setOpen(false);
        }}
      >
        <FormField id="nome" label="Nome" value={nome} onChange={setNome} />
        <FormField id="contato" label="Contato" value={contato} onChange={setContato} />
      </FormModal>
    </>
  );
}
