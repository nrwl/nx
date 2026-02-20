import { ButtonLink } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';

export interface DownloadCaseStudyProps {
  title: string;
  description: string;
  buttonHref: string;
  buttonText?: string;
  buttonCTA?: 'Download' | 'Read more';
  variant?: 'primary' | 'secondary' | 'contrast';
}

export function DownloadCaseStudy({
  title,
  description,
  buttonHref,
  buttonCTA = 'Download',
  buttonText = 'Download (pdf)',
  variant = 'contrast',
}: DownloadCaseStudyProps): ReactElement {
  return (
    <div className="flex h-full flex-col border border-zinc-100 bg-white shadow sm:rounded-lg dark:border-zinc-800/60 dark:bg-zinc-950">
      <div className="flex flex-1 flex-col px-4 py-5 sm:p-6">
        <h3 className="text-base font-semibold leading-6 text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <div className="mt-2 max-w-xl flex-1 text-sm">
          <p>{description}</p>
        </div>
        <div className="mt-auto pt-5">
          <ButtonLink
            href={buttonHref}
            title={`${buttonCTA} ${title}`}
            variant={variant}
            target={buttonCTA === 'Download' ? '_blank' : undefined}
            size="small"
          >
            {buttonText}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
