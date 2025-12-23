import { useState, useMemo } from 'react';

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

export type FilterValue = string | number | boolean | string[] | null | undefined;

interface UseFiltersOptions<T> {
  items: T[];
  filterFunctions: Record<string, (item: T) => boolean>;
  sortFunctions?: Record<string, (a: T, b: T) => number>;
  searchFields?: (keyof T)[];
}

/**
 * Generic hook for filtering and searching functionality
 * Reduces code duplication in AllBars, AllClubs, and other list components
 */
export const useFilters = <T>({
  items,
  filterFunctions,
  sortFunctions = {},
  searchFields = []
}: UseFiltersOptions<T>) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, FilterValue>>({});
  const [sortBy, setSortBy] = useState<string>('');

  // Memoized filtered and sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Apply search filter
    if (searchQuery && searchFields.length > 0) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        searchFields.some(field => 
          String(item[field]).toLowerCase().includes(query)
        )
      );
    }

    // Apply active filters
    Object.entries(activeFilters).forEach(([filterKey, filterValue]) => {
      if (filterValue && filterFunctions[filterKey]) {
        result = result.filter(filterFunctions[filterKey]);
      }
    });

    // Apply sorting
    if (sortBy && sortFunctions[sortBy]) {
      result.sort(sortFunctions[sortBy]);
    }

    return result;
  }, [items, searchQuery, activeFilters, sortBy, filterFunctions, sortFunctions, searchFields]);

  const updateFilter = (key: string, value: FilterValue) => {
    setActiveFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
    setSortBy('');
  };

  const hasActiveFilters = Object.values(activeFilters).some(Boolean) || !!searchQuery;

  return {
    filteredItems,
    searchQuery,
    setSearchQuery,
    activeFilters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    sortBy,
    setSortBy
  };
};