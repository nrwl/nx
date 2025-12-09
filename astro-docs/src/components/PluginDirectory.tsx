import { useState, useMemo } from 'react';

export type PluginType = 'official' | 'community';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  url: string;
  pluginType: PluginType;
  lastPublishedDate?: string;
  npmDownloads?: number;
  githubStars?: number;
  nxVersion?: string;
}


type OrderByStatus =
  | 'lastPublishedDate'
  | 'npmDownloads'
  | 'githubStars'
  | 'nxVersion'
  | undefined;


interface Modifiers {
  term: string;
  orderBy: OrderByStatus;
  orderDirection: 'ASC' | 'DESC';
}

function shortenNumber(num: number | undefined): string {
  if (!num) return '—';
  if (num >= 1_000_000) {
    return Math.floor(num / 1_000_000) + 'M';
  }
  if (num >= 1_000) {
    return Math.floor(num / 1_000) + 'k';
  }
  return num.toString();
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr));
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 6.75L12 3m0 0l3.75 3.75M12 3v18"
      />
    </svg>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25L12 21m0 0l-3.75-3.75M12 21V3"
      />
    </svg>
  );
}

function NxIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
    >
      <title>Nx</title>
      <path d="M11.987 14.138l-3.132 4.923-5.193-8.427-.012 8.822H0V4.544h3.691l5.247 8.833.005-3.998 3.044 4.759zm.601-5.761c.024-.048 0-3.784.008-3.833h-3.65c.002.059-.005 3.776-.003 3.833h3.645zm5.634 4.134a2.061 2.061 0 0 0-1.969 1.336 1.963 1.963 0 0 1 2.343-.739c.396.161.917.422 1.33.283a2.1 2.1 0 0 0-1.704-.88zm3.39 1.061c-.375-.13-.8-.277-1.109-.681-.06-.08-.116-.17-.176-.265a2.143 2.143 0 0 0-.533-.642c-.294-.216-.68-.322-1.18-.322a2.482 2.482 0 0 0-2.294 1.536 2.325 2.325 0 0 1 4.002.388.75.75 0 0 0 .836.334c.493-.105.46.36 1.203.518v-.133c-.003-.446-.246-.55-.75-.733zm2.024 1.266a.723.723 0 0 0 .347-.638c-.01-2.957-2.41-5.487-5.37-5.487a5.364 5.364 0 0 0-4.487 2.418c-.01-.026-1.522-2.39-1.538-2.418H8.943l3.463 5.423-3.379 5.32h3.54l1.54-2.366 1.568 2.366h3.541l-3.21-5.052a.7.7 0 0 1-.084-.32 2.69 2.69 0 0 1 2.69-2.691h.001c1.488 0 1.736.89 2.057 1.308.634.826 1.9.464 1.9 1.541a.707.707 0 0 0 1.066.596zm.35.133c-.173.372-.56.338-.755.639-.176.271.114.412.114.412s.337.156.538-.311c.104-.231.14-.488.103-.74z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>GitHub</title>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function PluginCard({ plugin }: { plugin: Plugin }) {
  const isExternal = plugin.pluginType === 'community';

  return (
    <a
      href={plugin.url}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="block h-full rounded-lg border border-slate-200 bg-gray-50 p-4 no-underline transition-colors hover:bg-gray-100 dark:border-slate-900 dark:bg-slate-800/50 dark:hover:bg-slate-800"
    >
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center gap-3">
          <GitHubIcon className="h-6 w-6 flex-shrink-0 text-gray-600 dark:text-slate-400" />
          <h3 className="text-base font-medium leading-tight text-gray-900 dark:text-slate-100">
            {plugin.name}
          </h3>
        </div>

        <p className="mb-4 line-clamp-3 flex-grow text-sm text-gray-600 dark:text-slate-400">
          {plugin.description}
        </p>

        <div className="flex flex-wrap items-center justify-between py-0.5 text-xs text-slate-700 dark:text-slate-400">
          {plugin.lastPublishedDate && (
            <div className="my-1 mr-1 flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>{formatDate(plugin.lastPublishedDate)}</span>
            </div>
          )}
          <div className="mx-1 my-1 flex items-center gap-1">
            <StarIcon className="h-4 w-4" />
            <span>{shortenNumber(plugin.githubStars)}</span>
          </div>
          <div className="mx-1 my-1 flex items-center gap-1">
            <DownloadIcon className="h-4 w-4" />
            <span>{shortenNumber(plugin.npmDownloads)}</span>
          </div>
          <div className="my-1 ml-1 flex flex-1 justify-end text-nowrap">
            {plugin.pluginType === 'official' ? (
              <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
                Nx Open Source
              </span>
            ) : plugin.nxVersion ? (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20">
                Nx {plugin.nxVersion}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20">
                Community
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

interface OrderButtonProps {
  label: string;
  icon: React.ReactNode;
  orderKey: OrderByStatus;
  modifiers: Modifiers;
  onClick: (key: OrderByStatus) => void;
}

function OrderButton({
  label,
  icon,
  orderKey,
  modifiers,
  onClick,
}: OrderButtonProps) {
  const isActive = modifiers.orderBy === orderKey;

  return (
    <button
      className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium transition
        ${
          isActive
            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
            : 'border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700'
        }`}
      onClick={() => onClick(orderKey)}
    >
      {icon}
      {label}
      {isActive && modifiers.orderDirection === 'ASC' && (
        <ArrowUpIcon className="h-3 w-3" />
      )}
      {isActive && modifiers.orderDirection === 'DESC' && (
        <ArrowDownIcon className="h-3 w-3" />
      )}
    </button>
  );
}

export function PluginDirectory({
  plugins: initialPlugins,
}: {
  plugins: Plugin[];
}) {
  const [modifiers, setModifiers] = useState<Modifiers>({
    term: '',
    orderBy: undefined,
    orderDirection: 'DESC',
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
        orderDirection: 'DESC',
      });
    }
  }

  const filteredAndSortedPlugins = useMemo(() => {
    let result = [...initialPlugins];

    // Filter by search term
    if (modifiers.term) {
      const term = modifiers.term.toLowerCase();
      result = result.filter(
        (plugin) =>
          plugin.name.toLowerCase().includes(term) ||
          plugin.description.toLowerCase().includes(term)
      );
    }

    // Sort
    if (modifiers.orderBy) {
      const direction = modifiers.orderDirection === 'ASC' ? 1 : -1;

      result.sort((a, b) => {
        switch (modifiers.orderBy) {
          case 'lastPublishDate': {
            const aTime = a.lastPublishedDate
              ? new Date(a.lastPublishedDate).getTime()
              : 0;
            const bTime = b.lastPublishedDate
              ? new Date(b.lastPublishedDate).getTime()
              : 0;
            return direction * (aTime - bTime);
          }
          case 'npmDownloads':
            return direction * ((a.npmDownloads || 0) - (b.npmDownloads || 0));
          case 'githubStars':
            return direction * ((a.githubStars || 0) - (b.githubStars || 0));
          case 'nxVersion': {
            const versionValueMap: Record<string, number> = {
              unknown: 0,
              '12': 12,
              '13': 13,
              '14': 14,
              '15': 15,
              '16': 16,
              '17': 17,
              '18': 18,
              '19': 19,
              '20': 20,
              '21': 21,
              '22': 22,
              '>= 15': 17,
              '>= 14': 16,
              '>= 13': 15,
              official: 1000,
            };
            function getValueFromVersion(
              version: string | undefined,
              pluginType: PluginType
            ) {
              if (pluginType === 'official') return versionValueMap['official'];
              if (!version) return 0;
              const mapKey =
                Object.keys(versionValueMap).find((key) =>
                  version.startsWith(key)
                ) || 'unknown';
              return versionValueMap[mapKey];
            }
            return (
              direction *
              (getValueFromVersion(a.nxVersion, a.pluginType) -
                getValueFromVersion(b.nxVersion, b.pluginType))
            );
          }
          default:
            return 0;
        }
      });
    }

    return result;
  }, [initialPlugins, modifiers]);

  return (
    <div className="not-content">
      {/* Search and Order Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-48">
          <label htmlFor="plugin-search" className="sr-only">
            Search plugins
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <SearchIcon className="h-4 w-4 text-slate-400" />
          </div>
          <input
            id="plugin-search"
            name="search"
            className="block w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:placeholder-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            placeholder="Search..."
            value={modifiers.term}
            onChange={(event) =>
              setModifiers({ ...modifiers, term: event.target.value })
            }
            type="search"
          />
        </div>

        {/* Order By */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-600 dark:text-slate-400">Order by:</span>
          <OrderButton
            label="Date"
            icon={<ClockIcon className="h-3.5 w-3.5" />}
            orderKey="lastPublishDate"
            modifiers={modifiers}
            onClick={setOrderBy}
          />
          <OrderButton
            label="Downloads"
            icon={<DownloadIcon className="h-3.5 w-3.5" />}
            orderKey="npmDownloads"
            modifiers={modifiers}
            onClick={setOrderBy}
          />
          <OrderButton
            label="Stars"
            icon={<StarIcon className="h-3.5 w-3.5" />}
            orderKey="githubStars"
            modifiers={modifiers}
            onClick={setOrderBy}
          />
          <OrderButton
            label="Version"
            icon={<NxIcon className="h-3.5 w-3.5" />}
            orderKey="nxVersion"
            modifiers={modifiers}
            onClick={setOrderBy}
          />
        </div>
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Showing {filteredAndSortedPlugins.length} of {initialPlugins.length}{' '}
        plugins
      </p>

      {/* Plugin Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {filteredAndSortedPlugins.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} />
        ))}
      </div>

      {filteredAndSortedPlugins.length === 0 && (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
          <p className="text-lg">
            No plugins found matching "{modifiers.term}"
          </p>
          <p className="mt-2 text-sm">Try a different search term</p>
        </div>
      )}
    </div>
  );
}
