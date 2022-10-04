import { ChevronRightIcon } from '@heroicons/react/24/outline';

export const InstallNxConsole = () => (
  <div className="not-prose group relative my-12 mx-auto flex w-full max-w-md items-center gap-3 overflow-hidden rounded-lg bg-slate-50 shadow-md transition hover:text-white dark:bg-slate-800/60">
    <div className="absolute inset-0 z-0 w-2 bg-blue-500 transition-all duration-150 group-hover:w-full dark:bg-sky-500"></div>
    <div className="w-2 bg-blue-500 dark:bg-sky-500"></div>

    <div className="z-10 flex flex-grow items-center py-3">
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        className="h-10 w-10 rounded-full object-cover"
      >
        <title>Visual Studio Code</title>
        <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
      </svg>

      <div className="mx-3">
        <p>
          Install Nx Console
          <a
            href="https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console"
            target="_blank"
            rel="noreferrer"
            className="block text-sm font-medium opacity-80"
          >
            <span className="absolute inset-0" aria-hidden="true"></span>
            The official VSCode plugin for Nx.
          </a>
        </p>
      </div>
    </div>
    <ChevronRightIcon className="mr-4 h-6 w-6 transition-all group-hover:translate-x-3" />
  </div>
);
