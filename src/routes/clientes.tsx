import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const resetForm = () => {
    setNome("");
    setTelefone("");
  };

  const createClienteMutation = useMutation({
    mutationFn: (payload: {
      nome: string;
      telefone: string | null;
      email: string | null;
      cidade: string | null;
    }) => erpRepository.createCliente(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente cadastrado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível cadastrar o cliente.");
    },
  });

  const handleSubmit = () => {
    const payload = {
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: null,
      cidade: null,
    };

    if (!payload.nome) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    createClienteMutation.mutate(payload);
  };

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
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            resetForm();
          }
        }}
        title="Novo cliente"
        description="Cadastre um novo cliente na base."
        onSubmit={handleSubmit}
        submitting={createClienteMutation.isPending}
      >
        <FormField id="nome" label="Nome" value={nome} onChange={setNome} />
        <FormField id="telefone" label="Telefone" value={telefone} onChange={setTelefone} />
      </FormModal>
    </>
  );
}
