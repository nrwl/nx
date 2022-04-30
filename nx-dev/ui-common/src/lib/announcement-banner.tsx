import Link from 'next/link';

export function AnnouncementBanner() {
  return (
    <div className="bg-slate-800">
      <div className="mx-auto max-w-7xl py-3 px-3 sm:px-6 lg:px-8">
        <div className="text-center sm:px-16 sm:pr-16">
          <p className="text-sm font-medium text-white">
            <span className="md:hidden">
              <Link href="/conf">
                <a className="text-white underline">
                  Nx Conf Lite is coming! 4/29
                </a>
              </Link>
            </span>
            <span className="hidden md:inline">
              To your agenda! Nx Conf Lite is on 4/29, a free to attend
              conference that you don't want to miss!
            </span>
            <span className="ml-2 inline-block">
              <Link href="/conf">
                <a className="font-bold text-white underline">
                  {' '}
                  Schedule and more info <span aria-hidden="true">&rarr;</span>
                </a>
              </Link>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AnnouncementBanner;
