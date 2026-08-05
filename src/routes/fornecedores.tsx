import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Column } from "@/components/erp/data-table";
import { FormField } from "@/components/erp/form-field";
import { FormModal } from "@/components/erp/form-modal";
import { ResourcePage } from "@/components/erp/resource-page";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/erp/format";
import { erpQueries } from "@/lib/erp/queries";
import { erpRepository } from "@/lib/erp/repository";
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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [categoria, setCategoria] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setNome("");
    setContato("");
    setCategoria("");
  };

  const openCreateModal = () => {
    resetForm();
    setOpen(true);
  };

  const openEditModal = (fornecedor: Fornecedor) => {
    setEditingId(fornecedor.id);
    setNome(fornecedor.nome);
    setContato(fornecedor.contato ?? "");
    setCategoria(fornecedor.categoria ?? "");
    setOpen(true);
  };

  const createFornecedorMutation = useMutation({
    mutationFn: (payload: { nome: string; contato: string | null; categoria: string | null }) =>
      erpRepository.createFornecedor(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor cadastrado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível salvar o fornecedor.");
    },
  });

  const updateFornecedorMutation = useMutation({
    mutationFn: (payload: { id: string; nome: string; contato: string | null; categoria: string | null }) =>
      erpRepository.updateFornecedor(payload.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor atualizado com sucesso.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível atualizar o fornecedor.");
    },
  });

  const deleteFornecedorMutation = useMutation({
    mutationFn: (id: string) => erpRepository.deleteFornecedor(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor removido com sucesso.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível remover o fornecedor.");
    },
  });

  const handleSubmit = () => {
    const payload = {
      nome: nome.trim(),
      contato: contato.trim() || null,
      categoria: categoria.trim() || null,
    };

    if (!payload.nome) {
      toast.error("Informe o nome do fornecedor.");
      return;
    }

    if (editingId) {
      updateFornecedorMutation.mutate({ id: editingId, ...payload });
      return;
    }

    createFornecedorMutation.mutate(payload);
  };

  return (
    <>
      <ResourcePage
        title="Fornecedores"
        description="Cadastro de fornecedores de insumos e embalagens."
        columns={[
          ...columns,
          {
            key: "actions",
            header: "Ações",
            cell: (fornecedor: Fornecedor) => (
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="rounded-xl px-2" onClick={() => openEditModal(fornecedor)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl px-2 text-destructive"
                  onClick={() => deleteFornecedorMutation.mutate(fornecedor.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]}
        rows={fornecedores}
        getRowId={(f) => f.id}
        actionLabel="Novo fornecedor"
        onAction={openCreateModal}
        emptyDescription="Nenhum fornecedor cadastrado. Os fornecedores aparecerão aqui."
      />

      <FormModal
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            resetForm();
          }
        }}
        title={editingId ? "Editar fornecedor" : "Novo fornecedor"}
        description="Cadastre ou edite um fornecedor para as compras do ERP."
        onSubmit={handleSubmit}
        submitting={createFornecedorMutation.isPending || updateFornecedorMutation.isPending}
        submitLabel={editingId ? "Atualizar" : "Salvar"}
      >
        <FormField id="nome" label="Nome" value={nome} onChange={setNome} placeholder="Distribuidora doce" />
        <FormField id="contato" label="Contato" value={contato} onChange={setContato} placeholder="(11) 99999-9999" />
        <FormField id="categoria" label="Categoria" value={categoria} onChange={setCategoria} placeholder="Insumos, embalagens, etc." />
      </FormModal>
    </>
  );
}
