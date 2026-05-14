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
 */

import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'

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
  function exportCsv(data: T[], options: ExportOptions = {}): void {
    const {
      filename = 'export',
      separator = ',',
      includeHeaders = true,
      columns,
    } = options

    const visibleColumns = columns
      ? state.visibleColumns.value.filter((c) => columns.includes(c.field))
      : state.visibleColumns.value

    const defMap = state.columnDefMap.value
    const lines: string[] = []

    if (includeHeaders) {
      const headerRow = visibleColumns
        .map((col) =>
          escapeCsvValue(defMap.get(col.field)?.headerName ?? col.field, separator),
        )
        .join(separator)
      lines.push(headerRow)
    }

    for (const row of data) {
      const values = visibleColumns.map((col) => {
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
      lines.push(values.join(separator))
    }

    downloadFile(`${filename}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;')
  }

  function exportJson(
    data: T[],
    options: { filename?: string; columns?: string[] } = {},
  ): void {
    const { filename = 'export', columns } = options

    const visibleColumns = columns
      ? state.visibleColumns.value.filter((c) => columns.includes(c.field))
      : state.visibleColumns.value

    const fields = visibleColumns.map((c) => c.field)
    const defMap = state.columnDefMap.value

    const exportData = data.map((row) => {
      const obj: Record<string, unknown> = {}
      for (const field of fields) {
        const def = defMap.get(field)
        if (def?.valueGetter) {
          obj[field] = def.valueGetter(row)
        } else {
          obj[field] = (row as Record<string, unknown>)[field]
        }
      }
      return obj
    })

    downloadFile(
      `${filename}.json`,
      JSON.stringify(exportData, null, 2),
      'application/json;charset=utf-8;',
    )
  }

  function escapeCsvValue(value: string, separator: string): string {
    if (value.includes(separator) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  function downloadFile(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
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

  return { exportCsv, exportJson }
}
