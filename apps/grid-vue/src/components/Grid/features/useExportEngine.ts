/**
 * Export engine — Angular parity (moz-grid / `ExportEngine`).
 *
 * Serialises a data slice into CSV or JSON and triggers a browser download.
 * Honours each column's `valueGetter` / `valueFormatter` / `headerName`, so
 * the exported payload matches what the user sees in the grid rather than
 * the raw underlying data.
 *
 * CSV escaping follows RFC 4180: values containing the separator, a double
 * quote, or a newline are wrapped in double quotes and embedded quotes are
 * doubled. The default separator is `,` but callers can override for regions
 * where semicolon-CSV is the norm (Excel FR / DE / PT ...).
 *
 * B18 — Streaming export: both exportCsv and exportJson use a TransformStream
 * to write 1 000-row chunks, avoiding >1 GB string allocations on very large
 * datasets (100k rows × 150 cols). A synchronous fallback is kept for
 * environments without TransformStream (jsdom in unit tests, old browsers).
 */

import type { GridState } from '../state/useGridState'
import type { ColumnStateEntry } from '../models/column.model'
import type { ColumnDef, RowData } from '../types'

export interface ExportOptions {
  filename?: string
  separator?: string
  includeHeaders?: boolean
  columns?: string[]
}

export interface ExportEngine<T = RowData> {
  exportCsv(data: T[], options?: ExportOptions): void
  exportJson(data: T[], options?: { filename?: string; columns?: string[] }): void
}

export function useExportEngine<T = RowData>(state: GridState<T>): ExportEngine<T> {
  // ── helpers ────────────────────────────────────────────────────────────────

  function escapeCsvValue(value: string, separator: string): string {
    if (value.includes(separator) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  function buildCsvRow(
    row: T,
    cols: ColumnStateEntry[],
    defMap: Map<string, ColumnDef<T>>,
    separator: string,
  ): string {
    return cols
      .map((col) => {
        const def = defMap.get(col.field)
        let value: unknown
        if (def?.valueGetter) {
          value = def.valueGetter(row)
        } else {
          value = (row as Record<string, unknown>)[col.field]
        }
        if (def?.valueFormatter) {
          return escapeCsvValue(def.valueFormatter(value, row), separator)
        }
        return escapeCsvValue(String(value ?? ''), separator)
      })
      .join(separator)
  }

  function downloadBlob(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function downloadFile(filename: string, content: string, mimeType: string): void {
    downloadBlob(filename, new Blob([content], { type: mimeType }))
  }

  // ── streaming helpers (B18) ────────────────────────────────────────────────

  async function exportCsvStreaming(
    data: T[],
    cols: ColumnStateEntry[],
    defMap: Map<string, ColumnDef<T>>,
    filename: string,
    separator: string,
    includeHeaders: boolean,
  ): Promise<void> {
    const encoder = new TextEncoder()
    const ts = new TransformStream<Uint8Array, Uint8Array>()
    const writer = ts.writable.getWriter()

    if (includeHeaders) {
      const headerRow =
        cols
          .map((col) => escapeCsvValue(defMap.get(col.field)?.headerName ?? col.field, separator))
          .join(separator) + '\n'
      await writer.write(encoder.encode(headerRow))
    }

    const CHUNK = 1_000
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk =
        data
          .slice(i, i + CHUNK)
          .map((row) => buildCsvRow(row, cols, defMap, separator))
          .join('\n') + '\n'
      await writer.write(encoder.encode(chunk))
    }

    await writer.close()
    const blob = await new Response(ts.readable).blob()
    downloadBlob(`${filename}.csv`, blob)
  }

  async function exportJsonStreaming(
    data: T[],
    fields: string[],
    defMap: Map<string, ColumnDef<T>>,
    filename: string,
  ): Promise<void> {
    const encoder = new TextEncoder()
    const ts = new TransformStream<Uint8Array, Uint8Array>()
    const writer = ts.writable.getWriter()

    await writer.write(encoder.encode('[\n'))

    const CHUNK = 1_000
    for (let i = 0; i < data.length; i += CHUNK) {
      const slice = data.slice(i, i + CHUNK)
      const isLast = i + CHUNK >= data.length
      const rows = slice.map((row) => {
        const obj: Record<string, unknown> = {}
        for (const field of fields) {
          const def = defMap.get(field)
          obj[field] = def?.valueGetter ? def.valueGetter(row) : (row as Record<string, unknown>)[field]
        }
        return obj
      })
      const chunk =
        rows
          .map((obj, idx) => '  ' + JSON.stringify(obj) + (isLast && idx === rows.length - 1 ? '' : ','))
          .join('\n') + '\n'
      await writer.write(encoder.encode(chunk))
    }

    await writer.write(encoder.encode(']'))
    await writer.close()
    const blob = await new Response(ts.readable).blob()
    downloadBlob(`${filename}.json`, blob)
  }

  // ── public API ─────────────────────────────────────────────────────────────

  function exportCsv(data: T[], options: ExportOptions = {}): void {
    const {
      filename = 'export',
      separator = ',',
      includeHeaders = true,
      columns,
    } = options

    const cols = columns
      ? state.visibleColumns.value.filter((c) => columns.includes(c.field))
      : state.visibleColumns.value

    const defMap = state.columnDefMap.value

    // B18: use streaming when available; fall back for test envs / old browsers.
    if (typeof TransformStream !== 'undefined') {
      void exportCsvStreaming(data, cols, defMap, filename, separator, includeHeaders)
      return
    }

    const lines: string[] = []
    if (includeHeaders) {
      lines.push(
        cols
          .map((col) => escapeCsvValue(defMap.get(col.field)?.headerName ?? col.field, separator))
          .join(separator),
      )
    }
    for (const row of data) {
      lines.push(buildCsvRow(row, cols, defMap, separator))
    }
    downloadFile(`${filename}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;')
  }

  function exportJson(
    data: T[],
    options: { filename?: string; columns?: string[] } = {},
  ): void {
    const { filename = 'export', columns } = options

    const cols = columns
      ? state.visibleColumns.value.filter((c) => columns.includes(c.field))
      : state.visibleColumns.value

    const fields = cols.map((c) => c.field)
    const defMap = state.columnDefMap.value

    // B18: use streaming when available; fall back for test envs / old browsers.
    if (typeof TransformStream !== 'undefined') {
      void exportJsonStreaming(data, fields, defMap, filename)
      return
    }

    const exportData = data.map((row) => {
      const obj: Record<string, unknown> = {}
      for (const field of fields) {
        const def = defMap.get(field)
        obj[field] = def?.valueGetter ? def.valueGetter(row) : (row as Record<string, unknown>)[field]
      }
      return obj
    })
    downloadFile(`${filename}.json`, JSON.stringify(exportData, null, 2), 'application/json;charset=utf-8;')
  }

  return { exportCsv, exportJson }
}
