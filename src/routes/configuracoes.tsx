import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Candy ERP" },
      { name: "description", content: "Preferências do sistema, usuários e permissões." },
      { property: "og:title", content: "Configurações — Candy ERP" },
      { property: "og:description", content: "Preferências do sistema, usuários e permissões." },
    ],
  }),
  component: ConfiguracoesPage,
});

const items = [
  { title: "Empresa", description: "Dados fiscais e identidade visual." },
  { title: "Usuários", description: "Equipe, cargos e permissões." },
  { title: "Preferências", description: "Tema, idioma e notificações." },
];

function ConfiguracoesPage() {
  return (
    <ModulePlaceholder
      title="Configurações"
      description="Preferências do sistema, usuários e permissões."
      icon={Settings}
      items={items}
    />
  );
}
