import { ButtonLink } from '@nx/nx-dev/ui-common';

export function DownloadCaseStudy(): JSX.Element {
  return (
    <div className="border border-slate-100 bg-white shadow-lg sm:rounded-lg dark:border-slate-800/60 dark:bg-slate-950">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">
          Our case study
        </h3>
        <div className="mt-2 sm:flex sm:items-start sm:justify-between">
          <div className="max-w-xl text-sm">
            <p>
              See how a $7B bank saved money, reduced CI times by 62% and
              improved developer productivity.
            </p>
          </div>
          <div className="mt-5 sm:ml-6 sm:mt-0 sm:flex sm:flex-shrink-0 sm:items-center">
            <ButtonLink
              href="https://go.nx.dev/bank-case-study"
              title="Download the case study"
              variant="primary"
              target="_blank"
              size="small"
            >
              Download (pdf)
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
