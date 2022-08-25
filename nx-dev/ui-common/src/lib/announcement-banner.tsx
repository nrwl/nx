import Link from 'next/link';

export function AnnouncementBanner(): JSX.Element {
  return (
    <div className="border-b border-slate-900/50 bg-slate-800">
      <div className="mx-auto max-w-7xl py-3 px-3 sm:px-6 lg:px-8">
        <div className="text-center sm:px-16 sm:pr-16">
          <p className="text-sm font-medium text-white">
            <span className="md:hidden">
              <Link href="/conf?utm_source=announcement-banner">
                <a className="text-white underline">
                  Nx Conf on October 17th in Phoenix AZ!
                </a>
              </Link>
            </span>
            <span className="hidden md:inline">
              <span className="font-black">
                Nx Conf on October 17th in Phoenix AZ
              </span>
              , do not miss it!
            </span>
            <span className="ml-2 inline-block">
              <Link href="/conf?utm_source=announcement-banner">
                <a className="font-semibold text-white underline">
                  {' '}
                  Tickets, Speakers, Schedule and more{' '}
                  <span aria-hidden="true">&rarr;</span>
                </a>
              </Link>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
