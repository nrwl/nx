import { ReactNode } from 'react';

export function NxCloudSection({ children }: { children: ReactNode }) {
  return (
    <div className="mt-16 mb-4 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
      <aside className="not-prose mb-4 flex flex-wrap items-center justify-between rounded-lg border border-slate-100 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/60">
        <div className="flex flex w-0 flex-1 items-center">
          <span className="flex">
            <svg
              aria-hidden="true"
              role="img"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="transparent"
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10"
            >
              <title>Nx Cloud</title>
              <path
                strokeWidth="2"
                d="M23 3.75V6.5c-3.036 0-5.5 2.464-5.5 5.5s-2.464 5.5-5.5 5.5-5.5 2.464-5.5 5.5H3.75C2.232 23 1 21.768 1 20.25V3.75C1 2.232 2.232 1 3.75 1h16.5C21.768 1 23 2.232 23 3.75Z"
              ></path>
              <path
                strokeWidth="2"
                d="M23 6v14.1667C23 21.7307 21.7307 23 20.1667 23H6c0-3.128 2.53867-5.6667 5.6667-5.6667 3.128 0 5.6666-2.5386 5.6666-5.6666C17.3333 8.53867 19.872 6 23 6Z"
              ></path>
            </svg>
          </span>
          <p className="ml-4 flex text-base">This section is about Nx Cloud.</p>
        </div>
        <div className="order-3 mt-2 w-full flex-shrink-0 sm:order-2 sm:mt-0 sm:w-auto">
          <a
            href="https://nx.app/?utm_source=nxdev"
            className="flex items-center justify-center rounded-md border border-transparent bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            Learn more
          </a>
        </div>
      </aside>

      {children}
    </div>
  );
}
