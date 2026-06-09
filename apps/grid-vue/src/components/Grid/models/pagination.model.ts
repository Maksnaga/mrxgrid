/**
 * Pagination / infinite-scroll models — Angular parity (ad-grid).
 */

export type LoadingStrategy = 'pagination' | 'infinite-scroll'

export interface PaginationState {
  pageIndex: number
  pageSize: number
  totalItems: number
  totalPages: number
}

/**
 * Pagination change event — emitted as `pageChange`.
 *
 * `page` is 1-based (Vue convention). `pageIndex` is 0-based (Angular
 * interop) and equals `page - 1`. Consumers only need one of the two;
 * both are included so Angular and Vue consumers can each use their
 * preferred convention without conversion.
 */
export interface PageEvent {
  /** Current page number, 1-based (Vue convention). */
  page: number
  /** Current page index, 0-based (Angular convention). Equals `page - 1`. */
  pageIndex: number
  /** Number of items per page. */
  pageSize: number
  /** 0-based index of the first item on this page. */
  startIndex: number
  /** 0-based index (exclusive) of the last item on this page. */
  endIndex: number
  /** Page number (1-based) before this change. */
  previousPageIndex: number
  /** Page size before this change. */
  previousPageSize: number
}

export interface LoadMoreEvent {
  offset: number
  limit: number
}
