'use client';
import { Popover, Transition } from '@headlessui/react';
import { CheckIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@nx/nx-dev/ui-common';
import { Fragment } from 'react';
import Link from 'next/link';

const features = [
  '300k credits included',
  'Max 1m runs per month',
  'Max 70 concurrent CI connections',
  'Max 30 contributors',
  'Unlimited private workspaces per organization',
  'High-priority support',
];

export function ProPlan({
  cta = 'Get started now',
  url,
}: {
  cta?: string;
  url: string;
}) {
  return (
    <article className="rounded-xl bg-white py-4 ring-1 ring-slate-200 xl:py-6 dark:bg-slate-950 dark:ring-slate-800">
      <header className="flex items-center justify-between gap-x-4">
        <h3
          id="pro-plan"
          className="px-4 text-xl font-semibold leading-8 text-slate-900 xl:px-6 dark:text-slate-100"
        >
          Pro
        </h3>
      </header>
      <p className="mt-4 h-12 px-4 text-sm leading-6 xl:px-6">
        Scales with your needs.
      </p>
      <p className="mt-8 flex items-baseline gap-x-1 px-4 xl:px-6">
        <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          $249
        </span>
        <span className="text-base font-normal leading-6">/month</span>
      </p>
      <div className="p-4 xl:p-6">
        <ButtonLink
          href={url}
          aria-describedby="pro-plan"
          title="Pro plan"
          size="default"
          variant="secondary"
          className="w-full"
        >
          {cta}
        </ButtonLink>
      </div>
      <Popover className="relative">
        <Popover.Button
          as="ul"
          className="cursor-pointer list-inside list-disc border-b border-t border-slate-100 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 dark:border-slate-800 dark:bg-green-500/10 dark:text-green-400"
        >
          <li>14-day free trial</li>
          <li>
            No credit card required{' '}
            <InformationCircleIcon className="inline h-4 w-4 align-top" />
          </li>
        </Popover.Button>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-300"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <Popover.Panel className="absolute z-10 mt-2 w-96 overflow-hidden rounded-md border border-slate-200 bg-white p-4 text-sm shadow dark:border-slate-800 dark:bg-slate-800">
            <p>
              Your organization will be deactivated upon reaching any Pro plan
              limit unless a credit card is set up in your account.
            </p>
          </Popover.Panel>
        </Transition>
      </Popover>
      <ul className="space-y-3 px-4 py-6 text-sm leading-6 text-slate-500 xl:px-6 dark:text-slate-400">
        <li className="text-base font-medium text-slate-700 dark:text-slate-300">
          Everything from the Hobby plan plus:
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
        <li className="flex gap-x-3">
          <CheckIcon
            className="h-6 w-5 flex-none text-blue-600 dark:text-sky-600"
            aria-hidden="true"
          />
          <p>
            <Link
              href="/ci/features/explain-with-ai"
              title="Learn more about Explain with AI"
              prefetch={false}
              className="font-medium text-slate-700 underline dark:text-slate-300"
            >
              Explain with AI
            </Link>
            : provide detailed explanations and insights for failed task
            outputs.
          </p>
        </li>
      </ul>
    </article>
  );
}
