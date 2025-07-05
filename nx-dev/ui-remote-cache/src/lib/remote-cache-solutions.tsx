'use client';
import { ReactElement } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/solid';
import { ButtonLink, SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import Link from 'next/link';

export function RemoteCacheSolutions(): ReactElement {
  return (
    <section id="plans" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h2" variant="display">
            Nx Remote Cache
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            Free remote caching solutions for any team.
          </SectionHeading>
        </header>

        <div className="mt-24 flow-root">
          <div className="-mt-16 grid max-w-full grid-cols-1 gap-12 sm:mx-auto lg:mt-0 lg:grid-cols-3 xl:-mx-4">
            {/* NX CLOUD */}
            <div>
              <div className="relative rounded-xl border-2 border-blue-500 bg-white p-8 dark:border-sky-500 dark:bg-slate-950">
                <span className="absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-6 transform items-center rounded-t-md bg-blue-500 px-2 py-1 text-xs font-medium text-white ring-1 ring-inset">
                  Recommended
                </span>
                <div className="flex items-center gap-x-2">
                  <h4 className="text-xl font-semibold leading-8 text-slate-950 dark:text-white">
                    Nx Cloud remote cache
                  </h4>
                </div>
                <p className="mt-2 text-sm">
                  Easiest setup, high performance, secure, fully managed by Nx.
                </p>
                <div className="my-8">
                  <ButtonLink
                    href="https://cloud.nx.app/get-started/?utm_source=nx-dev&utm_medium=remote-cache&utm_campaign=self-hosted-cache&utm_content=manage-remote-cache-with-nx-cloud"
                    aria-describedby="nx-cloud-remote-cache"
                    title="Start caching your builds with Nx Cloud"
                    size="default"
                    variant="primary"
                    onClick={() =>
                      sendCustomEvent(
                        'manage-remote-cache-with-nx-cloud',
                        'managed-remote-cache',
                        'remote-cache'
                      )
                    }
                    className="w-full"
                  >
                    Get started
                  </ButtonLink>
                </div>

                <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>Free plans available, no credit card required</span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>
                      Secure against cache poisoning (
                      <Link
                        href="/enterprise/security"
                        prefetch={false}
                        title="Remote caching security"
                        className="font-semibold underline"
                      >
                        learn more
                      </Link>
                      )
                    </span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>
                      SOC 2 compliant (
                      <a
                        href="https://security.nx.app/"
                        title="Check our SOC 2 security report"
                        className="font-semibold underline"
                      >
                        view report
                      </a>
                      )
                    </span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>Zero configuration</span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>
                      Hosted on Nx Cloud servers or on-premise with{' '}
                      <Link
                        href="/enterprise"
                        prefetch={false}
                        title="Learn about Nx Enterprise"
                        className="font-semibold underline"
                      >
                        Nx Enterprise
                      </Link>
                    </span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>
                      Enterprise grade access management and key revocation
                    </span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>Support</span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>
                      Includes access to advanced CI features: distributed task
                      execution, re-running flaky tasks and automatic tasks
                      splitting
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            {/*OFFICIAL PLUGINS*/}
            <div>
              <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-x-2">
                  <h4 className="text-xl font-semibold leading-8 text-slate-950 dark:text-white">
                    Self-hosted cache
                  </h4>
                </div>
                <p className="mt-2 text-sm">
                  Dedicated NPM packages for major storage providers, maintained
                  by Nx.
                </p>
                <div className="my-8">
                  <ButtonLink
                    href="/recipes/running-tasks/self-hosted-caching"
                    aria-describedby="official-plugins"
                    title="Free official remote cache plugins"
                    size="default"
                    variant="primary"
                    onClick={() =>
                      sendCustomEvent(
                        'learn-more-self-hosted-cache-plugins',
                        'self-hosted-cache',
                        'remote-cache'
                      )
                    }
                    className="w-full"
                  >
                    Learn more
                  </ButtonLink>
                </div>
                <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <ExclamationCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-yellow-600 dark:text-yellow-500"
                    />
                    <div>
                      <Strong>
                        Bucket-based solutions are vulnerable to cache poisoning
                        attacks. Most regulated organizations prohibit their
                        use.
                      </Strong>{' '}
                      Consult your security team before using. (
                      <Link
                        href="/enterprise/security#compliance-section"
                        prefetch={false}
                        title="Remote caching security"
                        className="font-semibold underline"
                      >
                        learn more
                      </Link>
                      )
                    </div>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>Free for all users</span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>Supports Amazon S3, MinIO, GCP, Azure</span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>Supports shared network drives</span>
                  </li>
                  <li className="flex items-start justify-start gap-x-2 py-2.5">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none text-blue-600 dark:text-sky-500"
                    />
                    <span>
                      Simple migration path from existing 3rd party plugins
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            {/*OPENAPI*/}
            <div>
              <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-x-2">
                  <h4 className="text-xl font-semibold leading-8 text-slate-950 dark:text-white">
                    Build your own
                  </h4>
                </div>
                <p className="mt-2 text-sm">
                  Create your own custom remote cache server.
                </p>

                <div className="mt-8">
                  <ButtonLink
                    href="/recipes/running-tasks/self-hosted-caching#build-your-own-caching-server"
                    aria-describedby="open-api"
                    title="Remote cache api specs"
                    size="default"
                    variant="primary"
                    onClick={() =>
                      sendCustomEvent(
                        'build-your-own-openapi',
                        'build-your-own',
                        'remote-cache'
                      )
                    }
                    className="w-full"
                  >
                    Learn more
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
