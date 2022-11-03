import Link from 'next/link';

export function AnnouncementBanner(): JSX.Element {
  return (
    <div className="group relative  border border-y border-slate-200 bg-slate-50/40 transition hover:bg-slate-50 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800">
      <div className="mx-auto max-w-7xl py-3 px-3 sm:px-6 lg:px-8">
        <div className="text-center sm:px-16 sm:pr-16">
          <p className="text-sm font-medium">
            <span className="md:hidden">
              <Link
                href="/conf?utm_source=announcement-banner text-blue-500 dark:text-sky-500"
                className="underline"
              >
                Nx Conf on October 17th in Phoenix AZ!
              </Link>
            </span>
            <span className="hidden md:inline">
              <span className="font-black">
                Nx Conf on October 17th in Phoenix AZ
              </span>
              , do not miss it!
            </span>
            <span className="ml-2 inline-block">
              <Link
                href="/conf?utm_source=announcement-banner"
                className="font-semibold text-blue-500 underline dark:text-sky-500"
              >
                <span className="absolute inset-0" aria-hidden="true" />{' '}
                Tickets, Speakers, Schedule and more{' '}
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
