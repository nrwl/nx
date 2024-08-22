import { CheckIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@nx/nx-dev/ui-common';
import Link from 'next/link';

const features = [
  '50k credits included',
  'Max 5 contributors',
  'Distributed Task Execution (DTE)',
  'Nx run detailed reports',
  'Structured log visualization',
  'GitHub PR with Nx Cloud live status',
  'Unlimited users per workspace',
  'Basic support',
];

export function HobbyPlan({
  cta = 'Get started now',
  url,
}: {
  cta?: string;
  url: string;
}) {
  return (
    <article className="relative rounded-b-xl bg-white py-4 ring-1 ring-blue-500 xl:py-6 dark:bg-slate-950 dark:ring-sky-500">
      <h4
        id="no-credit-card-required"
        className="absolute -top-9 left-0 w-full rounded-t-2xl bg-blue-500 p-2 text-center text-sm font-medium text-white shadow-inner ring-1 ring-blue-500 dark:bg-sky-500 dark:ring-sky-500"
      >
        Start here
      </h4>
      <header className="flex items-center justify-between gap-x-4 px-4 xl:px-6">
        <h3
          id="hobby-plan"
          className="text-xl font-semibold leading-8 text-slate-900 dark:text-slate-100"
        >
          Hobby
        </h3>
      </header>
      <p className="mt-4 h-12 px-4 text-sm leading-6 xl:px-6">
        Get started quickly, upgrade when ready.
      </p>
      <p className="mt-8 flex items-baseline gap-x-1 px-4 xl:px-6">
        <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          $0
        </span>
        <span className="text-base font-normal leading-6">/month</span>
      </p>
      <div className="p-4 xl:p-6">
        <ButtonLink
          href={url}
          aria-describedby="hobby-plan"
          title="Hobby"
          size="default"
          className="w-full"
        >
          {cta}
        </ButtonLink>
      </div>
      <p className="border-b border-t border-slate-100 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 xl:px-6 dark:border-slate-800 dark:bg-green-500/10 dark:text-green-400">
        No credit card required.
      </p>
      <ul className="space-y-3 px-4 py-8 text-sm leading-6 text-slate-500 xl:px-6 dark:text-slate-400">
        <li className="flex gap-x-3">
          <CheckIcon
            className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
            aria-hidden="true"
          />
          <p>
            <Link
              href="/ci/features/remote-cache"
              title="Learn more about Nx Replay"
              prefetch={false}
              className="font-medium text-slate-700 underline dark:text-slate-300"
            >
              Nx Replay
            </Link>
            : remote caching{' '}
          </p>
        </li>
        <li className="flex gap-x-3">
          <CheckIcon
            className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
            aria-hidden="true"
          />
          <p>
            <Link
              href="/ci/features/distribute-task-execution"
              title="Learn more about Nx Agents"
              prefetch={false}
              className="font-medium text-slate-700 underline dark:text-slate-300"
            >
              Nx Agents
            </Link>
            : native task distribution solution for CI{' '}
          </p>
        </li>
        {features.map((feature) => (
          <li key={feature} className="flex gap-x-3">
            <CheckIcon
              className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}
