import { ButtonLink } from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';

export interface DownloadCaseStudyProps {
  title: string;
  description: string;
  buttonHref: string;
  buttonText?: string;
}

export function DownloadCaseStudy({
  title,
  description,
  buttonHref,
  buttonText = 'Download (pdf)',
}: DownloadCaseStudyProps): ReactElement {
  return (
    <div className="border border-slate-100 bg-white shadow-lg sm:rounded-lg dark:border-slate-800/60 dark:bg-slate-950">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <div className="mt-2 sm:flex sm:items-start sm:justify-between">
          <div className="max-w-xl text-sm">
            <p>{description}</p>
          </div>
          <div className="mt-5 sm:ml-6 sm:mt-0 sm:flex sm:flex-shrink-0 sm:items-center">
            <ButtonLink
              href={buttonHref}
              title={`Download ${title}`}
              variant="primary"
              target="_blank"
              size="small"
            >
              {buttonText}
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
