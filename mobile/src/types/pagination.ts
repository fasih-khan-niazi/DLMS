export type PaginatedResponse<T> = {
  results: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const PAGE_SIZE = 15;
