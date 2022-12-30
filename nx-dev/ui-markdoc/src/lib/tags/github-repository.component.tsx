import { ChevronRightIcon } from '@heroicons/react/24/outline';

export function GithubRepository({ url }: { url: string }): JSX.Element {
  return (
    <div className="not-prose group relative my-12 mx-auto flex w-full max-w-md items-center gap-3 overflow-hidden rounded-lg bg-slate-50 shadow-md transition hover:text-white dark:bg-slate-800/60">
      <div className="absolute inset-0 z-0 w-2 bg-blue-500 transition-all duration-150 group-hover:w-full dark:bg-sky-500"></div>
      <div className="w-2 bg-blue-500 dark:bg-sky-500"></div>

      <div className="z-10 flex flex-grow items-center py-3">
        <svg
          className="h-10 w-10 rounded-full object-cover"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          ></path>
        </svg>

        <div className="mx-3">
          <p>
            Check the example:
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block text-sm font-medium opacity-80"
            >
              <span className="absolute inset-0" aria-hidden="true"></span>
              {url.replace(/^.*\/\/[^\/]+/, '')}
            </a>
          </p>
        </div>
      </div>
      <ChevronRightIcon className="mr-4 h-6 w-6 transition-all group-hover:translate-x-3" />
    </div>
  );
}
