/**
 * Pagination / infinite-scroll models — Angular parity (moz-grid).
 */

export type LoadingStrategy = 'pagination' | 'infinite-scroll'

export interface PaginationState {
  pageIndex: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface PageEvent {
  pageIndex: number
  pageSize: number
  previousPageIndex: number
  previousPageSize: number
}

export interface LoadMoreEvent {
  offset: number
  limit: number
}
