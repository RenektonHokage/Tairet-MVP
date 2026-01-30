import * as React from "react";

import { cn, panelUi } from "./panel-ui";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableEmptyState {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  empty?: DataTableEmptyState;
  rowActions?: (row: T) => React.ReactNode;
  skeletonRows?: number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  empty,
  rowActions,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const showEmpty = !isLoading && rows.length === 0;
  const colSpan = columns.length + (rowActions ? 1 : 0);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-neutral-200/70 bg-white">
      <div className="w-full overflow-x-auto">
        <table className="min-w-full">
          <thead className={panelUi.tableHead}>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={cn("px-4 py-3 text-left", column.className)}>
                  {column.header}
                </th>
              ))}
              {rowActions ? (
                <th className="px-4 py-3 text-right text-neutral-500">Acciones</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: skeletonRows }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className={panelUi.tableRow}>
                    <td colSpan={colSpan} className="px-4 py-3">
                      <div className={cn(panelUi.skeleton, "h-4 w-full")} />
                    </td>
                  </tr>
                ))
              : rows.map((row) => {
                  const key = rowKey(row);
                  return (
                    <tr key={key} className={cn(panelUi.tableRow, panelUi.tableRowHover)}>
                      {columns.map((column) => (
                        <td
                          key={`${key}-${column.key}`}
                          className={cn(panelUi.tableCell, column.className)}
                        >
                          {column.render
                            ? column.render(row)
                            : (row as Record<string, React.ReactNode>)[column.key]}
                        </td>
                      ))}
                      {rowActions ? (
                        <td className="px-4 py-3 text-right">{rowActions(row)}</td>
                      ) : null}
                    </tr>
                  );
                })}
            {showEmpty ? (
              <tr className={panelUi.tableRow}>
                <td colSpan={colSpan} className="px-4 py-6">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="text-sm font-semibold text-neutral-900">
                      {empty?.title ?? "Sin resultados"}
                    </div>
                    {empty?.description ? (
                      <p className="text-sm text-neutral-600">{empty.description}</p>
                    ) : null}
                    {empty?.action ? <div className="mt-2">{empty.action}</div> : null}
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
