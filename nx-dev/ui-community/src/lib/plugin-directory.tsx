import { SearchIcon } from '@heroicons/react/solid';
import { PluginCard } from '@nrwl/nx-dev/ui-common';
import { ReactComponentElement, useState } from 'react';

interface Plugin {
  description: string;
  name: string;
  url: string;
}

export function PluginDirectory({
  pluginList,
}: {
  pluginList: Plugin[];
}): ReactComponentElement<any> {
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
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="search"
              name="search"
              className="focus:border-blue-nx-base focus:ring-blue-nx-base block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:text-gray-900 focus:placeholder-gray-400 focus:outline-none focus:ring-1 sm:text-sm"
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
              url={plugin.url}
            />
          ))}
      </div>
    </div>
  );
}

export default PluginDirectory;
