import { ButtonLink } from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';

export function TrialCallout(): ReactElement {
  return (
    <section id="trial" className="isolate mx-auto max-w-xl">
      <div className="border border-slate-100 bg-white shadow-lg sm:rounded-lg dark:border-slate-800/60 dark:bg-slate-950">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">
            Looking for a trial?
          </h3>
          <div className="mt-2 sm:flex sm:items-start sm:justify-between">
            <div className="max-w-xl text-sm">
              <p>
                Start with our Hobby Plan - free forever for teams of any size.
                Perfect for proof of concept testing with up to 50,000 credits
                per month.
              </p>
            </div>
            <div className="mt-5 sm:ml-6 sm:mt-0 sm:flex sm:flex-shrink-0 sm:items-center">
              <ButtonLink
                href="https://cloud.nx.app"
                title="Start with Hobby"
                variant="primary"
                target="_blank"
                size="default"
              >
                Start for free
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
      {/*</motion.div>*/}
    </section>
  );
}
