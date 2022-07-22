export function AnnouncementBanner() {
  return (
    <div className="bg-slate-800">
      <div className="mx-auto max-w-7xl py-3 px-3 sm:px-6 lg:px-8">
        <div className="text-center sm:px-16 sm:pr-16">
          <p className="text-sm font-medium text-white">
            <span className="md:hidden">
              <a
                href="https://ti.to/nrwl/nx-workshop-7-2022/?utm_source=nxdev-announcement-banner"
                rel="noreferrer"
                target="_blank"
                className="text-white underline"
              >
                A new Nx workshop is coming on July 7th and 8th!
              </a>
            </span>
            <span className="hidden md:inline">
              To your agenda! A new Nx workshop will happen on July 7th and 8th,
              an online workshop to know how to Develop at Scale with Nx
              Monorepos!
            </span>
            <span className="ml-2 inline-block">
              <a
                href="https://ti.to/nrwl/nx-workshop-7-2022/?utm_source=nxdev-announcement-banner"
                rel="noreferrer"
                target="_blank"
                className="font-bold text-white underline"
              >
                {' '}
                Schedule and more info <span aria-hidden="true">&rarr;</span>
              </a>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AnnouncementBanner;
