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
import type { Cliente } from "@/lib/erp/types";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Candy ERP" },
      { name: "description", content: "Base de clientes, contatos e histórico de compras." },
      { property: "og:title", content: "Clientes — Candy ERP" },
      { property: "og:description", content: "Base de clientes, contatos e histórico de compras." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(erpQueries.clientes()),
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  component: ClientesPage,
});

const columns: Column<Cliente>[] = [
  { key: "nome", header: "Cliente", cell: (c) => <span className="font-medium">{c.nome}</span> },
  { key: "telefone", header: "Telefone", cell: (c) => c.telefone ?? "—" },
  { key: "email", header: "E-mail", cell: (c) => c.email ?? "—" },
  { key: "cidade", header: "Cidade", cell: (c) => c.cidade ?? "—" },
  { key: "created_at", header: "Cadastro", cell: (c) => formatDate(c.created_at) },
];

function ClientesPage() {
  const { data: clientes } = useSuspenseQuery(erpQueries.clientes());
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  return (
    <>
      <ResourcePage
        title="Clientes"
        description="Base de clientes, contatos e histórico de compras."
        columns={columns}
        rows={clientes}
        getRowId={(c) => c.id}
        actionLabel="Novo cliente"
        onAction={() => setOpen(true)}
        emptyDescription="Nenhum cliente cadastrado. Os clientes aparecerão aqui."
      />

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Novo cliente"
        description="Cadastro disponível após a conexão com o banco de dados."
        onSubmit={() => {
          toast.info("Banco de dados ainda não conectado.");
          setOpen(false);
        }}
      >
        <FormField id="nome" label="Nome" value={nome} onChange={setNome} />
        <FormField id="telefone" label="Telefone" value={telefone} onChange={setTelefone} />
      </FormModal>
    </>
  );
}
