import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { PluginCard, SectionHeading } from '@nx/nx-dev/ui-common';
import { useState } from 'react';

interface Plugin {
  description: string;
  name: string;
  url: string;
  isOfficial: boolean;
  lastPublishedDate?: string;
  npmDownloads?: string;
  githubStars?: string;
  nxVersion?: string;
}

interface Filters {
  term: string;
  officialStatus: 'official' | 'community' | undefined;
  minimumDownloads: number | undefined;
  minimumStars: number | undefined;
  minimumNxVersion: string | undefined;
}

export function PluginDirectory({
  pluginList,
}: {
  pluginList: Plugin[];
}): JSX.Element {
  const [filters, setFilters] = useState<Filters>({
    term: '',
    officialStatus: undefined,
    minimumDownloads: undefined,
    minimumStars: undefined,
    minimumNxVersion: undefined,
  });
  return (
    <div id="plugin-directory">
      <div className="flex w-full flex-col justify-between gap-8 md:flex-row ">
        <SectionHeading as="h2" variant="display" id="plugins-registry">
          Nx Plugins Registry
        </SectionHeading>
        <div>
          <label htmlFor="search" className="sr-only">
            Quick search
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-500" />
            </div>
            <input
              id="search"
              name="search"
              className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-slate-500 transition focus:placeholder-slate-400 dark:border-slate-900 dark:bg-slate-700"
              placeholder="Quick search"
              onChange={(event) =>
                setFilters({ ...filters, term: event.target.value })
              }
              type="search"
            />
          </div>
        </div>
      </div>
      <div className="my-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {pluginList
          .filter((plugin) =>
            !!filters.term
              ? plugin.name
                  .toLowerCase()
                  .includes(filters.term.toLowerCase()) ||
                plugin.description
                  .toLowerCase()
                  .includes(filters.term.toLowerCase())
              : true
          )
          .map((plugin) => (
            <PluginCard
              key={plugin.name}
              name={plugin.name}
              description={plugin.description}
              isOfficial={plugin.isOfficial}
              lastPublishedDate={plugin.lastPublishedDate}
              npmDownloads={plugin.npmDownloads}
              githubStars={plugin.githubStars}
              nxVersion={plugin.nxVersion}
              url={plugin.url}
            />
          ))}
      </div>
    </div>
  );
}
