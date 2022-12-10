import Link from 'next/link';

export function AnnouncementBanner(): JSX.Element {
  return (
    <div className="group relative  border border-y border-slate-200 bg-slate-50/40 transition hover:bg-slate-50 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800">
      <div className="mx-auto max-w-7xl py-3 px-3 sm:px-6 lg:px-8">
        <div className="text-center sm:px-16 sm:pr-16">
          <p className="text-sm font-medium">
            <span className="md:hidden">
              <Link href="https://stateofjs.com/en-us/" className="underline">
                State of JS survey:
              </Link>
            </span>
            <span className="hidden md:inline">
              <span className="font-semibold">
                State of JS survey is online!
              </span>
            </span>
            <span className="ml-2 inline-block">
              <Link
                href="https://stateofjs.com/en-us/"
                rel="noreferrer"
                target="_blank"
                className="font-semibold text-blue-500 underline dark:text-sky-500"
              >
                <span className="absolute inset-0" aria-hidden="true" />
                Give Nx & Lerna a thumbs up
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
