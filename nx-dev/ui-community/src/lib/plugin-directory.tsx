import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { PluginCard } from '@nrwl/nx-dev/ui-common';
import { useState } from 'react';

interface Plugin {
  description: string;
  name: string;
  url: string;
  isOfficial: boolean;
}

export function PluginDirectory({
  pluginList,
}: {
  pluginList: Plugin[];
}): JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  return (
    <div
      id="plugin-directory"
      className="max-w-screen mx-auto p-4 lg:max-w-7xl lg:px-8"
    >
      <div className="flex w-full flex-col justify-between gap-8 md:flex-row ">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
          Nx Plugin Directory
        </h2>
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
              onChange={(event) => setSearchTerm(event.target.value)}
              type="search"
            />
          </div>
        </div>
      </div>
      <div className="my-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {pluginList
          .filter((plugin) =>
            !!searchTerm
              ? plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                plugin.description
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())
              : true
          )
          .map((plugin) => (
            <PluginCard
              key={plugin.name}
              name={plugin.name}
              description={plugin.description}
              isOfficial={plugin.isOfficial}
              url={plugin.url}
            />
          ))}
      </div>
    </div>
  );
}
