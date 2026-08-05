import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/erp/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Candy ERP" },
      { name: "description", content: "Dados da empresa, taxas de plataformas e preferências." },
      { property: "og:title", content: "Configurações — Candy ERP" },
      {
        property: "og:description",
        content: "Dados da empresa, taxas de plataformas e preferências.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const [empresa, setEmpresa] = useState("");
  const [documento, setDocumento] = useState("");
  const [margem, setMargem] = useState("");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Configurações"
        description="Dados da empresa, taxas de plataformas e preferências."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Dados da empresa</CardTitle>
            <CardDescription>Informações usadas em documentos e relatórios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="empresa" label="Nome da empresa" value={empresa} onChange={setEmpresa} />
            <FormField id="documento" label="CNPJ" value={documento} onChange={setDocumento} />
            <Separator />
            <Button
              className="rounded-xl"
              onClick={() => toast.info("Banco de dados ainda não conectado.")}
            >
              Salvar
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Parâmetros operacionais</CardTitle>
            <CardDescription>Margem padrão e regras de cálculo das vendas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              id="margem"
              label="Margem de custo padrão (%)"
              type="number"
              value={margem}
              onChange={setMargem}
            />
            <Separator />
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => toast.info("Banco de dados ainda não conectado.")}
            >
              Salvar parâmetros
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
