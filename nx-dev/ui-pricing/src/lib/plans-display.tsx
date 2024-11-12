'use client';
import { ReactElement } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import Link from 'next/link';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';

export function PlansDisplay(): ReactElement {
  return (
    <section id="plans" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-4xl text-center">
          <SectionHeading as="h2" variant="display">
            Start with everything,
            <br /> scale when you need
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            Level up your CI with Nx Cloud
          </SectionHeading>
        </header>
        <div className="mt-20 flow-root">
          <div className="isolate -mt-16 grid max-w-full grid-cols-1 gap-6 sm:mx-auto lg:mt-0 lg:grid-cols-3 xl:-mx-4 xl:gap-8">
            {/*HOBBY*/}
            <div>
              <div className="rounded-lg border-2 border-blue-500 bg-white p-6 dark:border-sky-500 dark:bg-slate-950">
                <div className="flex items-center gap-x-2">
                  <h4 className="text-xl font-semibold leading-8 text-slate-950 dark:text-white">
                    Hobby
                  </h4>
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                    Free forever
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  Perfect for small teams or proofs of concept to evaluate the
                  product. No credit card required.
                </p>
                <p className="mt-4 pb-5 leading-5">
                  <span className="text-3xl font-semibold text-slate-950 dark:text-white">
                    $0
                  </span>
                </p>
                <div className="my-12">
                  <ButtonLink
                    href="https://cloud.nx.app"
                    aria-describedby="hobby-plan"
                    title="Start now"
                    size="default"
                    variant="primary"
                    onClick={() =>
                      sendCustomEvent(
                        'start-hobby-plan-click',
                        'plans-table',
                        'pricing-plans'
                      )
                    }
                    className="w-full"
                  >
                    Get started
                  </ButtonLink>
                </div>
                <ul className="mt-4 divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <li className="py-2.5">
                    <span className="font-medium">Included for free</span>
                  </li>
                  <li className="flex items-center justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>50,000 monthly credits</span>
                  </li>
                  <li className="flex items-center justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>
                      Remote caching with{' '}
                      <Link
                        href="/ci/features/remote-cache"
                        target="_blank"
                        title="Learn how Nx Replay easily reduces CI execution time"
                        onClick={() =>
                          sendCustomEvent(
                            'learn-nx-replay-click',
                            'plans-table',
                            'pricing-plans'
                          )
                        }
                        className="font-medium underline decoration-dotted"
                      >
                        Nx Replay
                      </Link>
                    </span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>
                      Distributed task execution with{' '}
                      <Link
                        href="/ci/features/distribute-task-execution"
                        target="_blank"
                        title="Learn how Nx Agents easily scale your CI pipelines"
                        onClick={() =>
                          sendCustomEvent(
                            'learn-nx-agents-click',
                            'plans-table',
                            'pricing-plans'
                          )
                        }
                        className="font-medium underline decoration-dotted"
                      >
                        Nx Agents
                      </Link>
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/*TEAM*/}
            <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-x-2">
                <h4 className="text-xl font-semibold leading-8 text-slate-950 dark:text-white">
                  Team
                </h4>
              </div>
              <p className="mt-2 text-sm">
                Start free, pay as you grow. Billed on the first of each month.
              </p>
              <p className="mt-4 leading-5">
                <span className="text-3xl font-semibold text-slate-950 dark:text-white">
                  $19
                </span>
                <span className="text-lg"> per Active Contributor¹</span>{' '}
                <span className="text-sm font-semibold italic">
                  (first 5 free)
                </span>
                <br />
                <span className="text-sm">+ usage overages</span>
              </p>

              <div className="my-12">
                <ButtonLink
                  href="https://cloud.nx.app"
                  aria-describedby="team-plan"
                  title="Get started"
                  size="default"
                  variant="secondary"
                  onClick={() =>
                    sendCustomEvent(
                      'start-team-plan-click',
                      'plans-table',
                      'pricing-plans'
                    )
                  }
                  className="w-full"
                >
                  Get started
                </ButtonLink>
              </div>
              <ul className="mt-4 divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <li className="py-2.5">
                  <span className="font-medium">Included for free</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>5 active contributors¹</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>50,000 monthly credits</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>10 concurrent CI connections</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <Link
                    href="/nx-cloud#ai-for-your-ci"
                    target="_blank"
                    title="Check our AI integrations and how to use them"
                    onClick={() =>
                      sendCustomEvent(
                        'learn-ai-integrations-click',
                        'plans-table',
                        'pricing-plans'
                      )
                    }
                    className="font-medium underline decoration-dotted"
                  >
                    AI integrations
                  </Link>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>Email support</span>
                </li>
                <li className="py-2.5">
                  <span className="font-medium">Add-ons</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <PlusIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>$19 per active contributor¹ / month</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <PlusIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>$5.50 per 10,000 credits</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <PlusIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>$2.25 per concurrent CI connection</span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                ¹Any person or actor that has triggered a CI Pipeline Execution
                within the current billing cycle. Up to 70 active contributors.
              </p>
            </div>

            {/* ENTERPRISE */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-x-2">
                <h4 className="text-xl font-semibold leading-8 text-slate-950 dark:text-white">
                  Enterprise
                </h4>
              </div>
              <p className="mt-2 text-sm">
                The ultimate Nx toolchain, tailored for speed. Flexible billing
                & payment options available.
              </p>
              <p className="mt-4 pb-5 leading-5">
                <span className="text-3xl font-semibold text-slate-950 dark:text-white">
                  Custom
                </span>
              </p>
              <div className="my-12">
                <ButtonLink
                  href="/enterprise"
                  aria-describedby="enterprise-plan"
                  title="Enterprise"
                  size="default"
                  variant="secondary"
                  onClick={() =>
                    sendCustomEvent(
                      'learn-enterprise-click',
                      'plans-table',
                      'pricing-plans'
                    )
                  }
                  className="w-full"
                >
                  Learn more
                </ButtonLink>
              </div>
              <ul className="mt-4 divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <li className="py-2.5">
                  <span className="font-medium">Includes</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>Volume discounts on credits available</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>White glove onboarding</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>
                    <Link
                      href="/powerpack"
                      target="_blank"
                      title="Check our AI integrations and how to use them"
                      onClick={() =>
                        sendCustomEvent(
                          'learn-nx-powerpack-click',
                          'plans-table',
                          'pricing-plans'
                        )
                      }
                      className="font-medium underline decoration-dotted"
                    >
                      Nx Powerpack
                    </Link>
                    : a suite of premium extensions for the Nx CLI
                  </span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>
                    Work hand-in-hand with the Nx team for continual improvement
                  </span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>
                    Run on the Nx Cloud servers in any region or run fully
                    self-contained, on-prem
                  </span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>SSO / SAML Login</span>
                </li>
                <li className="flex items-start justify-start gap-x-2 py-2.5">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                  />
                  <span>Premium Support and SLAs available</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm opacity-80">
              Credits are the Nx Cloud currency allowing for usage based
              pricing. Prices do not include applicable taxes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
