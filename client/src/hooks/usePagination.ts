import { useState, useMemo, useEffect } from "react";

interface UsePaginationProps<T> {
  data: T[];
  pageSize?: number;
  resetDeps?: any[];
}

export function usePagination<T>({ data, pageSize = 10, resetDeps = [] }: UsePaginationProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = data.length === 0 ? 0 : Math.ceil(data.length / pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, resetDeps);

  useEffect(() => {
    if (totalPages === 0) {
      setCurrentPage(1);
    } else if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    if (totalPages === 0) return [];
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize, totalPages]);

  const goToPage = (page: number) => {
    if (totalPages === 0) return;
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return {
    currentItems,
    currentPage,
    totalPages,
    totalItems: data.length,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}
