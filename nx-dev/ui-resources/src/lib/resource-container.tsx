'use client';
import { useMemo } from 'react';
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

  const filters = useMemo(() => {
    return ALL_RESOURCE_TYPES;
  }, []);

  const selectedFilter = useMemo(() => {
    const filterBy = searchParams.get('filterBy');
    return filterBy || 'All';
  }, [searchParams]);

  const selectedFilterHeading = useMemo(() => {
    const filter = ALL_RESOURCE_TYPES.find((f) => f.value === selectedFilter);
    return filter?.heading || 'All Resources';
  }, [selectedFilter]);

  const filteredList = useMemo(() => {
    if (selectedFilter === 'All') {
      return resources;
    }
    return resources.filter((resource) => resource.category === selectedFilter);
  }, [selectedFilter, resources]);

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
            <Filters filters={filters} selectedFilter={selectedFilter} />
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
