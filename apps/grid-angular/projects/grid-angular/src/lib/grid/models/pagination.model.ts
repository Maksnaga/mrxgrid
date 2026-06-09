export type LoadingStrategy = 'pagination' | 'infinite-scroll';

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PageEvent {
  pageIndex: number;
  pageSize: number;
  previousPageIndex: number;
  previousPageSize: number;
  /** Zero-based index of the first item on the new page (pageIndex * pageSize). */
  startIndex: number;
  /** Zero-based index of the last item on the new page (startIndex + pageSize - 1). */
  endIndex: number;
}

export interface LoadMoreEvent {
  offset: number;
  limit: number;
}
