import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import type { Column } from "@/components/erp/data-table";
import { DataTable } from "@/components/erp/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ResourcePage<T>({
  title,
  description,
  columns,
  rows,
  loading,
  getRowId,
  actionLabel,
  onAction,
  emptyDescription,
  children,
  toolbar,
}: {
  title: string;
  description: string;
  columns: Column<T>[];
  rows: T[];
  loading?: boolean | undefined;
  getRowId: (row: T, index: number) => string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  emptyDescription?: string | undefined;
  children?: ReactNode | undefined;
  toolbar?: ReactNode | undefined;
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={title}
        description={description}
        actions={
          actionLabel && onAction ? (
            <Button onClick={onAction} className="rounded-xl shadow-[var(--shadow-glow)]">
              <Plus className="h-4 w-4" />
              {actionLabel}
            </Button>
          ) : undefined
        }
      />

      {toolbar}

      <Card className="rounded-2xl border-border/70">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            getRowId={getRowId}
            emptyDescription={
              emptyDescription ?? "Nenhum registro cadastrado ainda. Os dados aparecerão aqui."
            }
            emptyAction={
              actionLabel && onAction ? (
                <Button variant="outline" className="rounded-xl" onClick={onAction}>
                  <Plus className="h-4 w-4" />
                  {actionLabel}
                </Button>
              ) : undefined
            }
          />
        </CardContent>
      </Card>

      {children}
    </div>
  );
}
