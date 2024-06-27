import { ButtonLink } from '@nx/nx-dev/ui-common';

export function DownloadEbook(): JSX.Element {
  return (
    <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
      <div className="relative isolate overflow-hidden bg-slate-50/70 px-6 pb-4 pt-16 shadow-2xl ring-1 ring-slate-200 sm:rounded-3xl sm:px-16 sm:pb-0 md:pt-24 lg:flex lg:gap-x-20 lg:px-24 lg:pt-0 dark:border dark:border-slate-800/60 dark:bg-slate-950 dark:ring-slate-800/60">
        <svg
          viewBox="0 0 1024 1024"
          className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
          aria-hidden="true"
        >
          <circle
            cx={512}
            cy={512}
            r={512}
            fill="url(#759c1415-0410-454c-8f7c-9a820de03641)"
            fillOpacity="0.7"
          />
          <defs>
            <radialGradient id="759c1415-0410-454c-8f7c-9a820de03641">
              <stop stopColor="#7775D6" />
              <stop offset={1} stopColor="#a855f7" />
            </radialGradient>
          </defs>
        </svg>
        <div className="mx-auto max-w-md text-center lg:mx-0 lg:flex-auto lg:py-12 lg:text-left">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-slate-50">
            Download our ebook
          </h2>
          <p className="mt-6 text-lg leading-8">
            Discover how to scale your organization without feeling the pain of
            CI, while having a better developer experience and fitting your
            requirements.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6 lg:justify-start">
            <ButtonLink
              href="https://go.nx.dev/fast-CI-whitepaper?utm_source=nx-dev&utm_medium=download-whitepaper-enterprise-banner"
              title="Download Fast CI whitepaper"
              target="_blank"
            >
              <span>Download</span>{' '}
              <span className="text-xs italic">(pdf)</span>
            </ButtonLink>
          </div>
        </div>
        <div className="relative mt-16 hidden h-72 sm:block lg:mt-8">
          <img
            className="absolute left-0 top-0 w-[42rem] max-w-none rounded-md bg-white/5 ring-1 ring-white/10"
            src="images/white-paper-ebook.avif"
            alt="App screenshot"
            width={1200}
            height={675}
          />
          <span className="absolute left-4 top-4 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
            ebook
          </span>
        </div>
      </div>
    </div>
  );
}
