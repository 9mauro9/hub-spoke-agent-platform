import React from 'react';
import { Database } from 'lucide-react';
import { clsx } from 'clsx';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  className?: string;
  headerClassName?: string;
  cell?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  isColdQueryLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  isColdQueryLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There is no telemetry data available for the selected filters.',
  emptyAction,
  onRowClick,
  className
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full border border-slate-800 rounded-lg overflow-hidden bg-slate-900/50">
        <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4">
          <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-slate-800/60 p-2 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 bg-slate-800/40 rounded flex items-center px-4 gap-6 animate-pulse">
              <div className="h-3.5 w-24 bg-slate-700/60 rounded" />
              <div className="h-3.5 w-48 bg-slate-700/50 rounded" />
              <div className="h-3.5 w-32 bg-slate-700/40 rounded" />
              <div className="h-3.5 w-20 bg-slate-700/30 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full border border-slate-800 rounded-lg bg-slate-900/30 py-16 px-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3 border border-slate-700">
          <Database className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300">{emptyTitle}</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">{emptyDescription}</p>
        {emptyAction && <div className="mt-4 flex justify-center">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className={clsx('w-full border border-slate-800/90 rounded-lg overflow-hidden bg-slate-900/60 backdrop-blur-sm', className)}>
      {isColdQueryLoading && (
        <div className="h-0.5 w-full bg-brand-950 overflow-hidden">
          <div className="h-full bg-brand-500 animate-pulse w-full" />
        </div>
      )}
      <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900/95 sticky top-0 z-10 border-b border-slate-800 shadow-sm backdrop-blur">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={clsx(
                    'py-2.5 px-3.5 font-semibold text-slate-400 tracking-wider uppercase text-[11px] select-none whitespace-nowrap',
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick && onRowClick(item)}
                className={clsx(
                  'transition-colors hover:bg-slate-800/50 group',
                  onRowClick ? 'cursor-pointer' : ''
                )}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className={clsx('py-2.5 px-3.5 text-slate-300 whitespace-nowrap', col.className)}
                  >
                    {col.cell
                      ? col.cell(item)
                      : col.accessorKey
                      ? (item[col.accessorKey] as React.ReactNode)
                      : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
