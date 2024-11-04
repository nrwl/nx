import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import {
  ButtonLink,
  SectionDescription,
  SectionHeading,
} from '@nx/nx-dev/ui-common';
import { NxIcon } from '@nx/nx-dev/ui-icons';

export function NxBrand() {
  return (
    <article id="nx" className="relative">
      <div className="mx-auto max-w-7xl gap-16 px-4 sm:grid sm:grid-cols-2 sm:px-6 lg:px-8">
        <div>
          <header>
            <SectionHeading as="h2" variant="title">
              Nx
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-4">
              Smart monorepos · Fast CI
            </SectionHeading>
            <SectionDescription as="p" className="mt-2">
              The Nx trademark includes the Nx name & logo, and any word,
              phrase, image, or other designation that identifies any NX
              products. Please don’t modify the marks or use them in a confusing
              way, including suggesting sponsorship or endorsement by Nx, or in
              a way that confuses Nx with another brand.
            </SectionDescription>
          </header>
          <h4 className="mt-4 text-lg leading-8 text-slate-700 sm:text-xl dark:text-slate-300">
            Spelling
          </h4>
          <p className="mt-2 text-base text-slate-700 dark:text-slate-400">
            The preferred written format is Nx. <br /> For social media usage,
            <span className="mx-1 inline-flex items-center rounded-full bg-slate-100 px-3 py-0.5 text-sm font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-300">
              #NxDevTools
            </span>{' '}
            is an accepted format.
          </p>
          <ButtonLink
            variant="secondary"
            size="default"
            target="_blank"
            title="Download"
            href="/assets/brand-kits/nx-logos-assets.zip"
            className="my-12"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            <span>
              Download Nx assets <span className="text-sm italic">(zip)</span>
            </span>
          </ButtonLink>
        </div>
        <div aria-hidden="true">
          <div className="w-full rounded-md border border-slate-100 bg-slate-50/20 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="grid grid-cols-1 items-center justify-items-center rounded-sm bg-white p-2 ring-1 ring-slate-50 dark:bg-slate-800/80 dark:ring-slate-800">
              <NxIcon className="m-20 h-28 w-28 text-slate-900 dark:text-slate-100" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
