import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  items,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  items: { title: string; description: string }[];
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title={title} description={description} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card
            key={item.title}
            className="rounded-2xl border-border/70 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
          >
            <CardHeader>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-accent-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3 text-base">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 rounded-full bg-primary/70" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Módulo em estruturação</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
