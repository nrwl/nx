export function TopSchemaLayout({
  name,
  url,
}: {
  name: string;
  url: string;
}): JSX.Element {
  return (
    <div className="mb-8 flex w-full items-center space-x-2">
      <div className="w-full flex-grow">
        <div
          className="relative inline-flex rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase dark:border-slate-700 dark:bg-slate-800/60"
          aria-hidden="true"
          data-tooltip="Installable Package"
        >
          Package
        </div>
        <a
          className="relative mx-4 inline-flex rounded-md border border-green-100 bg-green-50 px-4 py-2 text-xs font-medium text-green-600 dark:border-green-900 dark:bg-green-900/30 dark:text-green-400"
          href="/recipes/other/rescope"
          title="Nx 16 package name changes"
        >
          Rescope @nrwl to @nx
        </a>
      </div>
      <div className="relative z-0 inline-flex flex-shrink-0">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-hidden="true"
          title="See package on GitHub"
          className="relative inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800/60"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
            ></path>
          </svg>
          {name}
        </a>
      </div>
    </div>
  );
}
