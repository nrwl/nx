import { CheckIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@nx/nx-dev/ui-common';

export function Oss(): JSX.Element {
  return (
    <section
      id="oss"
      className="bg-blue-500 bg-gradient-to-r from-blue-500 to-cyan-500 shadow-inner"
    >
      <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Open Source maintainers and authors?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-100">
            We provide a <span className="font-black">$0 /month</span> plan for
            open-source projects.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <ButtonLink
              href="/pricing/special-offer"
              aria-describedby="oss"
              title="Free for Open Source"
              size="default"
              variant="secondary"
            >
              Apply for free access
            </ButtonLink>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-4xl flex-col gap-8 text-sm text-white md:flex-row md:justify-between">
          <div className="flex items-center gap-1">
            <CheckIcon className="h-6 w-5 flex-none" aria-hidden="true" /> Free
            credits every month
          </div>
          <div className="flex items-center gap-1">
            <CheckIcon className="h-6 w-5 flex-none" aria-hidden="true" />
            Max 3 admin users
          </div>
          <div className="flex items-center gap-1">
            <CheckIcon className="h-6 w-5 flex-none" aria-hidden="true" />{' '}
            Powerful analytics
          </div>
          <div className="flex items-center gap-1">
            <CheckIcon className="h-6 w-5 flex-none" aria-hidden="true" /> Basic
            support
          </div>
        </div>
      </div>
    </section>
  );
}
