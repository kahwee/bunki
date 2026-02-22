import { expect, test, describe } from "bun:test";
import {
  createPagination,
  getPaginatedItems,
  getTotalPages,
} from "../../src/utils/pagination";

describe("Pagination Utilities", () => {
  describe("createPagination", () => {
    test("should create pagination data for first page", () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const pagination = createPagination(items, 1, 10, "/");

      expect(pagination.currentPage).toBe(1);
      expect(pagination.totalPages).toBe(3);
      expect(pagination.totalItems).toBe(25);
      expect(pagination.pageSize).toBe(10);
      expect(pagination.hasNextPage).toBe(true);
      expect(pagination.hasPrevPage).toBe(false);
      expect(pagination.nextPage).toBe(2);
      expect(pagination.prevPage).toBeNull();
      expect(pagination.pagePath).toBe("/");
    });

    test("should create pagination data for middle page", () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const pagination = createPagination(items, 2, 10, "/");

      expect(pagination.currentPage).toBe(2);
      expect(pagination.hasNextPage).toBe(true);
      expect(pagination.hasPrevPage).toBe(true);
      expect(pagination.nextPage).toBe(3);
      expect(pagination.prevPage).toBe(1);
    });

    test("should create pagination data for last page", () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const pagination = createPagination(items, 3, 10, "/");

      expect(pagination.currentPage).toBe(3);
      expect(pagination.hasNextPage).toBe(false);
      expect(pagination.hasPrevPage).toBe(true);
      expect(pagination.nextPage).toBeNull();
      expect(pagination.prevPage).toBe(2);
    });

    test("should handle single page", () => {
      const items = Array.from({ length: 5 }, (_, i) => i);
      const pagination = createPagination(items, 1, 10, "/");

      expect(pagination.currentPage).toBe(1);
      expect(pagination.totalPages).toBe(1);
      expect(pagination.hasNextPage).toBe(false);
      expect(pagination.hasPrevPage).toBe(false);
      expect(pagination.nextPage).toBeNull();
      expect(pagination.prevPage).toBeNull();
    });
  });

  describe("getPaginatedItems", () => {
    test("should return correct slice for first page", () => {
      const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const paginated = getPaginatedItems(items, 1, 5);

      expect(paginated).toEqual([0, 1, 2, 3, 4]);
    });

    test("should return correct slice for second page", () => {
      const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const paginated = getPaginatedItems(items, 2, 5);

      expect(paginated).toEqual([5, 6, 7, 8, 9]);
    });

    test("should return correct slice for last page (partial)", () => {
      const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const paginated = getPaginatedItems(items, 3, 5);

      expect(paginated).toEqual([10, 11]);
    });

    test("should return empty array for out-of-range page", () => {
      const items = [0, 1, 2, 3, 4];
      const paginated = getPaginatedItems(items, 10, 5);

      expect(paginated).toEqual([]);
    });
  });

  describe("getTotalPages", () => {
    test("should calculate total pages correctly", () => {
      expect(getTotalPages(25, 10)).toBe(3);
      expect(getTotalPages(30, 10)).toBe(3);
      expect(getTotalPages(31, 10)).toBe(4);
      expect(getTotalPages(5, 10)).toBe(1);
      expect(getTotalPages(0, 10)).toBe(0);
    });

    test("should handle edge cases", () => {
      expect(getTotalPages(1, 1)).toBe(1);
      expect(getTotalPages(100, 1)).toBe(100);
      expect(getTotalPages(1, 100)).toBe(1);
    });
  });
});
