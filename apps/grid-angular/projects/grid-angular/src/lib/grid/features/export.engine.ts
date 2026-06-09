/**
 * B18 — Streaming export: both exportCsv and exportJson write data in
 * 1 000-row chunks via TransformStream, avoiding >1 GB string allocations
 * on very large datasets (100k rows × 150 cols). A synchronous fallback
 * is kept for environments without TransformStream (old browsers).
 */
import { inject, Injectable } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { ColumnStateEntry, ColumnDef } from '../models/column.model';

export interface ExportOptions {
  filename?: string;
  separator?: string;
  includeHeaders?: boolean;
  columns?: string[];
}

@Injectable()
export class ExportEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  // ── helpers ─────────────────────────────────────────────────────────────

  private escapeCsvValue(value: string, separator: string): string {
    if (value.includes(separator) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private buildCsvRow(
    row: T,
    cols: ColumnStateEntry[],
    defMap: Map<string, ColumnDef<T>>,
    separator: string,
  ): string {
    return cols
      .map((col) => {
        const def = defMap.get(col.field);
        let value: unknown;
        if (def?.valueGetter) {
          value = def.valueGetter(row);
        } else {
          value = (row as Record<string, unknown>)[col.field];
        }
        if (def?.valueFormatter) {
          return this.escapeCsvValue(def.valueFormatter(value, row), separator);
        }
        return this.escapeCsvValue(String(value ?? ''), separator);
      })
      .join(separator);
  }

  private downloadBlob(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private downloadFile(filename: string, content: string, mimeType: string): void {
    this.downloadBlob(filename, new Blob([content], { type: mimeType }));
  }

  // ── streaming helpers (B18) ──────────────────────────────────────────────

  private async exportCsvStreaming(
    data: T[],
    cols: ColumnStateEntry[],
    defMap: Map<string, ColumnDef<T>>,
    filename: string,
    separator: string,
    includeHeaders: boolean,
  ): Promise<void> {
    const encoder = new TextEncoder();
    const ts = new TransformStream<Uint8Array, Uint8Array>();
    const writer = ts.writable.getWriter();

    if (includeHeaders) {
      const headerRow =
        cols
          .map((col) => this.escapeCsvValue(defMap.get(col.field)?.headerName ?? col.field, separator))
          .join(separator) + '\n';
      await writer.write(encoder.encode(headerRow));
    }

    const CHUNK = 1_000;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk =
        data
          .slice(i, i + CHUNK)
          .map((row) => this.buildCsvRow(row, cols, defMap, separator))
          .join('\n') + '\n';
      await writer.write(encoder.encode(chunk));
    }

    await writer.close();
    const blob = await new Response(ts.readable).blob();
    this.downloadBlob(`${filename}.csv`, blob);
  }

  private async exportJsonStreaming(
    data: T[],
    fields: string[],
    defMap: Map<string, ColumnDef<T>>,
    filename: string,
  ): Promise<void> {
    const encoder = new TextEncoder();
    const ts = new TransformStream<Uint8Array, Uint8Array>();
    const writer = ts.writable.getWriter();

    await writer.write(encoder.encode('[\n'));

    const CHUNK = 1_000;
    for (let i = 0; i < data.length; i += CHUNK) {
      const slice = data.slice(i, i + CHUNK);
      const isLast = i + CHUNK >= data.length;
      const rows = slice.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const field of fields) {
          const def = defMap.get(field);
          obj[field] = def?.valueGetter
            ? def.valueGetter(row)
            : (row as Record<string, unknown>)[field];
        }
        return obj;
      });
      const chunk =
        rows
          .map((obj, idx) => '  ' + JSON.stringify(obj) + (isLast && idx === rows.length - 1 ? '' : ','))
          .join('\n') + '\n';
      await writer.write(encoder.encode(chunk));
    }

    await writer.write(encoder.encode(']'));
    await writer.close();
    const blob = await new Response(ts.readable).blob();
    this.downloadBlob(`${filename}.json`, blob);
  }

  // ── public API ───────────────────────────────────────────────────────────

  exportCsv(data: T[], options: ExportOptions = {}): void {
    const {
      filename = 'export',
      separator = ',',
      includeHeaders = true,
      columns,
    } = options;

    const cols = columns
      ? this.state.visibleColumns().filter((c) => columns.includes(c.field))
      : this.state.visibleColumns();

    const defMap = this.state.columnDefMap();

    // B18: stream when available, synchronous fallback otherwise.
    if (typeof TransformStream !== 'undefined') {
      void this.exportCsvStreaming(data, cols, defMap, filename, separator, includeHeaders);
      return;
    }

    const lines: string[] = [];
    if (includeHeaders) {
      lines.push(
        cols
          .map((col) => this.escapeCsvValue(defMap.get(col.field)?.headerName ?? col.field, separator))
          .join(separator),
      );
    }
    for (const row of data) {
      lines.push(this.buildCsvRow(row, cols, defMap, separator));
    }
    this.downloadFile(`${filename}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
  }

  exportJson(data: T[], options: { filename?: string; columns?: string[] } = {}): void {
    const { filename = 'export', columns } = options;

    const cols = columns
      ? this.state.visibleColumns().filter((c) => columns.includes(c.field))
      : this.state.visibleColumns();

    const fields = cols.map((c) => c.field);
    const defMap = this.state.columnDefMap();

    // B18: stream when available, synchronous fallback otherwise.
    if (typeof TransformStream !== 'undefined') {
      void this.exportJsonStreaming(data, fields, defMap, filename);
      return;
    }

    const exportData = data.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const field of fields) {
        const def = defMap.get(field);
        obj[field] = def?.valueGetter
          ? def.valueGetter(row)
          : (row as Record<string, unknown>)[field];
      }
      return obj;
    });
    this.downloadFile(`${filename}.json`, JSON.stringify(exportData, null, 2), 'application/json;charset=utf-8;');
  }
}
