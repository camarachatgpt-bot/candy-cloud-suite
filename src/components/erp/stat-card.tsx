import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  loading,
  footer,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string | undefined;
  loading?: boolean | undefined;
  footer?: ReactNode | undefined;
}) {
  return (
    <Card className="rounded-2xl border-border/70 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="truncate">{label}</CardDescription>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24 rounded-lg" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        )}
        {footer ?? (
          <p className="mt-1 text-xs text-muted-foreground">{hint ?? "Sem dados"}</p>
        )}
      </CardContent>
    </Card>
  );
}
