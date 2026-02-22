/**
 * Pagination utilities
 */

export interface PaginationData {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
  pageSize: number;
  totalItems: number;
  pagePath: string;
}

/**
 * Create pagination data for a list of items
 * @param items - Array of items to paginate
 * @param currentPage - Current page number (1-indexed)
 * @param pageSize - Number of items per page
 * @param pagePath - Base path for pagination (e.g., "/", "/tags/tech/")
 * @returns Pagination data object
 */
export function createPagination<T>(
  items: T[],
  currentPage: number,
  pageSize: number,
  pagePath: string,
): PaginationData {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    currentPage,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null,
    pageSize,
    totalItems,
    pagePath,
  };
}

/**
 * Get paginated slice of items for a specific page
 * @param items - Array of items to paginate
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of items per page
 * @returns Slice of items for the requested page
 */
export function getPaginatedItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): T[] {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return items.slice(startIndex, endIndex);
}

/**
 * Calculate total number of pages needed for items
 * @param totalItems - Total number of items
 * @param pageSize - Number of items per page
 * @returns Total number of pages
 */
export function getTotalPages(totalItems: number, pageSize: number): number {
  return Math.ceil(totalItems / pageSize);
}
