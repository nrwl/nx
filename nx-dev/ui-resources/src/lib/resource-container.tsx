'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Resource } from './types';
import { Filters } from './filters';
import { ResourceGrid } from './resource-grid';
import { ALL_RESOURCE_TYPES } from './resource-types';

export interface ResourceContainerProps {
  resources: Resource[];
}

export function ResourceContainer({ resources }: ResourceContainerProps) {
  const searchParams = useSearchParams();
  const [filteredList, setFilteredList] = useState(resources);

  const filters = useMemo(() => {
    return ALL_RESOURCE_TYPES;
  }, []);

  const { initialSelectedFilterHeading, initialSelectedFilter } = useMemo(
    () => initializeFilters(resources, searchParams),
    [resources, searchParams]
  );

  const [selectedFilterHeading, setSelectedFilterHeading] = useState(
    initialSelectedFilterHeading
  );

  useEffect(() => {
    const filterBy = searchParams.get('filterBy');
    if (filterBy) {
      const filteredResources =
        filterBy === 'All'
          ? resources
          : resources.filter((resource) => resource.category === filterBy);
      setFilteredList(filteredResources);
    } else {
      setFilteredList(resources);
    }
  }, [searchParams, resources]);

  return (
    <main id="main" role="main" className="w-full py-8">
      <div className="mx-auto mb-8 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 mt-20">
          <h1
            id="resources-title"
            className="text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl dark:text-slate-100"
          >
            {selectedFilterHeading}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Download whitepapers, books, case studies, and cheatsheets to learn
            more about Nx and modern development practices.
          </p>
        </header>
        <div className="mb-12 flex items-center justify-between">
          <div className="flex items-center">
            <Filters
              resources={resources}
              filters={filters}
              initialSelectedFilter={initialSelectedFilter}
              setFilteredList={setFilteredList}
              setSelectedFilterHeading={setSelectedFilterHeading}
            />
          </div>
        </div>

        {filteredList.length > 0 ? (
          <ResourceGrid resources={filteredList} />
        ) : (
          <div className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              No resources found in this category.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function initializeFilters(
  resources: Resource[],
  searchParams: ReadonlyURLSearchParams
) {
  const filterBy = searchParams.get('filterBy');

  const defaultState = {
    initialSelectedFilterHeading: 'All Resources',
    initialSelectedFilter: 'All',
  };

  if (!filterBy) {
    return defaultState;
  }

  const initialFilter = ALL_RESOURCE_TYPES.find(
    (filter) => filter.value === filterBy
  );

  return {
    initialSelectedFilterHeading: initialFilter?.heading || 'All Resources',
    initialSelectedFilter: initialFilter?.value || 'All',
  };
}
