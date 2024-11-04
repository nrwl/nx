'use client';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@nx/nx-dev/ui-common';

export function PowerpackPricing() {
  return (
    <aside>
      {/*<h4 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-100">*/}
      {/*  Nx Powerpack license subscription*/}
      {/*</h4>*/}

      <div className="flex flex-col gap-2">
        <div className="group relative flex w-full items-center justify-between gap-8 rounded-md border border-slate-200 bg-white px-6 py-4 transition hover:bg-white/90 hover:shadow dark:border-slate-800/60 dark:bg-slate-900/60 dark:hover:bg-slate-900/100">
          <a
            href="https://cloud.nx.app/powerpack/purchase?utm_source=nx.dev&utm_medium=referral&utm_campaign=nx-powerpackurl"
            title="Buy your license"
            className="flex items-center gap-2"
          >
            <span className="absolute inset-0" />

            <ArrowRightIcon aria-hidden="true" className="size-4" />
            <span className="text-sm font-medium leading-none text-slate-900 dark:text-slate-50">
              Billed annually
            </span>
            <span className="inline-flex items-center gap-x-1 whitespace-nowrap rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-900 ring-1 ring-inset ring-blue-500/30 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
              Save 20%
            </span>
          </a>
          <p className="text-base">
            <span className="font-semibold text-slate-950 dark:text-white">
              $250
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              /seat
            </span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <div className="group relative flex w-full items-center justify-between gap-8 rounded-md border border-slate-200 bg-white px-6 py-4 transition hover:bg-white/90 hover:shadow dark:border-slate-800/60 dark:bg-slate-900/60 dark:hover:bg-slate-900/100">
          <a
            href="https://cloud.nx.app/powerpack/purchase?utm_source=nx.dev&utm_medium=referral&utm_campaign=nx-powerpackurl"
            title="Buy your license"
            className="flex items-center gap-2"
          >
            <span className="absolute inset-0" />
            <ArrowRightIcon aria-hidden="true" className="size-4" />
            <span className="text-sm font-medium leading-none text-slate-900 dark:text-slate-50">
              Billed monthly
            </span>
          </a>
          <p className="text-base">
            <span className="font-semibold text-slate-950 dark:text-white">
              $26
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              /seat
            </span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <ButtonLink
          href="https://cloud.nx.app/powerpack/purchase?utm_source=nx.dev&utm_medium=referral&utm_campaign=nx-powerpackurl"
          title="Talk to the engineering team"
          variant="primary"
          size="default"
        >
          Buy your Nx Powerpack license
        </ButtonLink>
      </div>
    </aside>
  );
}
