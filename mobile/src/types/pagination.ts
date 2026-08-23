export type PaginatedResponse<T> = {
  results: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const DEFAULT_PAGE_SIZE = 10;
