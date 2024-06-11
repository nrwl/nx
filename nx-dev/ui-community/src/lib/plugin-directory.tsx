import {
  ArrowLongDownIcon,
  ArrowLongUpIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
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

type OrderByStatus =
  | 'lastPublishDate'
  | 'npmDownloads'
  | 'githubStars'
  | 'nxVersion'
  | undefined;
interface Modifiers {
  term: string;
  officialStatus: 'official' | 'community' | undefined;
  minimumDownloads: number | undefined;
  minimumStars: number | undefined;
  minimumNxVersion: string | undefined;
  orderBy: OrderByStatus;
  orderDirection: 'ASC' | 'DESC';
}

export function PluginDirectory({
  pluginList,
}: {
  pluginList: Plugin[];
}): JSX.Element {
  const [modifiers, setModifiers] = useState<Modifiers>({
    term: '',
    officialStatus: undefined,
    minimumDownloads: undefined,
    minimumStars: undefined,
    minimumNxVersion: undefined,
    orderBy: undefined,
    orderDirection: 'ASC',
  });
  function setOrderBy(status: OrderByStatus) {
    if (modifiers.orderBy === status) {
      setModifiers({
        ...modifiers,
        orderDirection: modifiers.orderDirection === 'ASC' ? 'DESC' : 'ASC',
      });
    } else {
      setModifiers({
        ...modifiers,
        orderBy: status,
      });
    }
  }
  return (
    <div id="plugin-directory">
      <div className="flex w-full flex-col justify-between gap-8 md:flex-row ">
        <SectionHeading as="h2" variant="display" id="plugins-registry">
          <span className="whitespace-nowrap">Nx Plugins</span> Registry
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
                setModifiers({ ...modifiers, term: event.target.value })
              }
              type="search"
            />
          </div>
          <div className="my-2 flex whitespace-nowrap text-xs">
            <div className="mr-1 py-1">Order by:</div>
            <div className="flex flex-wrap gap-1">
              <button
                className="rounded-sm border border-slate-200 bg-white px-1 py-1 font-semibold transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={() => setOrderBy('lastPublishDate')}
              >
                <ClockIcon className="mr-0.5 inline-block h-4 w-4 align-bottom"></ClockIcon>
                Release Date
                {modifiers.orderBy === 'lastPublishDate' &&
                modifiers.orderDirection === 'ASC' ? (
                  <ArrowLongUpIcon className="ml-0.5 inline-block h-4 w-4 align-bottom"></ArrowLongUpIcon>
                ) : null}
                {modifiers.orderBy === 'lastPublishDate' &&
                modifiers.orderDirection === 'DESC' ? (
                  <ArrowLongDownIcon className="ml-0.5 inline-block h-4 w-4 align-bottom"></ArrowLongDownIcon>
                ) : null}
              </button>
              <button
                className="rounded-sm border border-slate-200 bg-white px-1 py-1 font-semibold transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={() => setOrderBy('npmDownloads')}
              >
                <ArrowDownTrayIcon className="mr-0.5 inline-block h-4 w-4 align-bottom"></ArrowDownTrayIcon>
                Downloads
                {modifiers.orderBy === 'npmDownloads' &&
                modifiers.orderDirection === 'ASC' ? (
                  <ArrowLongUpIcon className="ml-0.5 inline-block h-4 w-4 align-bottom"></ArrowLongUpIcon>
                ) : null}
                {modifiers.orderBy === 'npmDownloads' &&
                modifiers.orderDirection === 'DESC' ? (
                  <ArrowLongDownIcon className="ml-0.5 inline-block h-4 w-4 align-bottom"></ArrowLongDownIcon>
                ) : null}
              </button>
              <button
                className="rounded-sm border border-slate-200 bg-white px-1 py-1 font-semibold transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={() => setOrderBy('githubStars')}
              >
                <StarIcon className="mr-0.5 inline-block h-4 w-4 align-bottom"></StarIcon>
                GH Stars
                {modifiers.orderBy === 'githubStars' &&
                modifiers.orderDirection === 'ASC' ? (
                  <ArrowLongUpIcon className="ml-0.5 inline-block h-4 w-4 align-bottom"></ArrowLongUpIcon>
                ) : null}
                {modifiers.orderBy === 'githubStars' &&
                modifiers.orderDirection === 'DESC' ? (
                  <ArrowLongDownIcon className="ml-0.5 inline-block h-4 w-4 align-bottom"></ArrowLongDownIcon>
                ) : null}
              </button>
              <button
                className="rounded-sm border border-slate-200 bg-white px-1 py-1 font-semibold transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={() => setOrderBy('nxVersion')}
              >
                {/* Nx Logo */}
                <svg
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  className="mx-0.5 inline-block h-4 w-4 align-bottom"
                  fill="currentColor"
                >
                  <title>Nx</title>
                  <path d="M11.987 14.138l-3.132 4.923-5.193-8.427-.012 8.822H0V4.544h3.691l5.247 8.833.005-3.998 3.044 4.759zm.601-5.761c.024-.048 0-3.784.008-3.833h-3.65c.002.059-.005 3.776-.003 3.833h3.645zm5.634 4.134a2.061 2.061 0 0 0-1.969 1.336 1.963 1.963 0 0 1 2.343-.739c.396.161.917.422 1.33.283a2.1 2.1 0 0 0-1.704-.88zm3.39 1.061c-.375-.13-.8-.277-1.109-.681-.06-.08-.116-.17-.176-.265a2.143 2.143 0 0 0-.533-.642c-.294-.216-.68-.322-1.18-.322a2.482 2.482 0 0 0-2.294 1.536 2.325 2.325 0 0 1 4.002.388.75.75 0 0 0 .836.334c.493-.105.46.36 1.203.518v-.133c-.003-.446-.246-.55-.75-.733zm2.024 1.266a.723.723 0 0 0 .347-.638c-.01-2.957-2.41-5.487-5.37-5.487a5.364 5.364 0 0 0-4.487 2.418c-.01-.026-1.522-2.39-1.538-2.418H8.943l3.463 5.423-3.379 5.32h3.54l1.54-2.366 1.568 2.366h3.541l-3.21-5.052a.7.7 0 0 1-.084-.32 2.69 2.69 0 0 1 2.69-2.691h.001c1.488 0 1.736.89 2.057 1.308.634.826 1.9.464 1.9 1.541a.707.707 0 0 0 1.066.596zm.35.133c-.173.372-.56.338-.755.639-.176.271.114.412.114.412s.337.156.538-.311c.104-.231.14-.488.103-.74z" />
                </svg>
                Nx Version
                {modifiers.orderBy === 'nxVersion' &&
                modifiers.orderDirection === 'DESC' ? (
                  <ArrowLongUpIcon className="ml-0.5 inline-block h-4 w-4 align-bottom"></ArrowLongUpIcon>
                ) : null}
                {modifiers.orderBy === 'nxVersion' &&
                modifiers.orderDirection === 'ASC' ? (
                  <ArrowLongDownIcon className="ml-0.5 inline-block h-4 w-4 align-bottom"></ArrowLongDownIcon>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="my-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {pluginList
          .filter((plugin) =>
            !!modifiers.term
              ? plugin.name
                  .toLowerCase()
                  .includes(modifiers.term.toLowerCase()) ||
                plugin.description
                  .toLowerCase()
                  .includes(modifiers.term.toLowerCase())
              : true
          )
          .sort((a, b) => {
            if (modifiers.orderBy === 'lastPublishDate') {
              return (
                (modifiers.orderDirection === 'ASC' ? 1 : -1) *
                (new Date(a.lastPublishedDate || '').getTime() -
                  new Date(b.lastPublishedDate || '').getTime())
              );
            } else if (modifiers.orderBy === 'npmDownloads') {
              return (
                (modifiers.orderDirection === 'ASC' ? 1 : -1) *
                (Number.parseInt(a.npmDownloads || '0') -
                  Number.parseInt(b.npmDownloads || '0'))
              );
            } else if (modifiers.orderBy === 'githubStars') {
              return (
                (modifiers.orderDirection === 'ASC' ? 1 : -1) *
                (Number.parseInt(a.githubStars || '0') -
                  Number.parseInt(b.githubStars || '0'))
              );
            } else if (modifiers.orderBy === 'nxVersion') {
              const versionValueMap: Record<string, number> = {
                unknown: 0,
                '12': 12,
                '13': 13,
                '14': 14,
                '15': 15,
                '16': 16,
                '17': 17,
                '18': 18,
                '>= 15': 17,
                '>= 14': 16,
                '>= 13': 15,
                official: 1000,
              };
              function getValueFromVersion(version: string = 'unknown') {
                const mapKey =
                  Object.keys(versionValueMap).find((key) =>
                    version.startsWith(key)
                  ) || 'unknown';
                return versionValueMap[mapKey];
              }
              return (
                (modifiers.orderDirection === 'ASC' ? 1 : -1) *
                (getValueFromVersion(a.nxVersion) -
                  getValueFromVersion(b.nxVersion))
              );
            }
            return 0;
          })
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
