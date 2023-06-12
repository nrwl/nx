import { ChevronRightIcon } from '@heroicons/react/24/outline';

export function StackblitzButton({
  url,
  title,
}: {
  url: string;
  title: string;
}): JSX.Element {
  const resolvedUrl = url.replace('https://', '');

  return (
    <div className="not-prose group relative my-12 mx-auto flex w-full max-w-md items-center gap-3 overflow-hidden rounded-lg bg-slate-50 shadow-md transition hover:text-white dark:bg-slate-800/60">
      <div className="absolute inset-0 z-0 w-2 bg-blue-500 transition-all duration-150 group-hover:w-full dark:bg-sky-500"></div>
      <div className="w-2 bg-blue-500 dark:bg-sky-500"></div>

      <div className="z-10 flex flex-grow items-center py-3">
        <svg
          className="h-10 w-10 rounded-full object-cover"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <title>StackBlitz</title>
          <path d="M10.797 14.182H3.635L16.728 0l-3.525 9.818h7.162L7.272 24l3.524-9.818Z" />
        </svg>

        <div className="mx-3">
          <p>
            {title ? title : 'Open in Stackblitz'}
            <a
              href={`https://stackblitz.com/${resolvedUrl}`}
              target="_blank"
              rel="noreferrer"
              className="block text-sm font-medium opacity-80"
            >
              <span className="absolute inset-0" aria-hidden="true"></span>
            </a>
          </p>
        </div>
      </div>
      <ChevronRightIcon className="mr-4 h-6 w-6 transition-all group-hover:translate-x-3" />
    </div>
  );
}
