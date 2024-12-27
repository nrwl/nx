import { ReactElement } from 'react';
import { SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import {
  AcademicCapIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  CodeBracketSquareIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  EyeIcon,
  ShieldExclamationIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export function ScaleYourOrganization(): ReactElement {
  return (
    <section className="overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:items-start">
          <div className="flex items-start justify-end lg:order-first">
            <img
              alt="Nx Polygraph"
              src="/images/enterprise/neurons-light.avif"
              width={2111}
              height={921}
              className="w-[48rem] max-w-none sm:w-[57rem] md:-mr-4 lg:mr-0 dark:hidden"
            />
            <img
              alt="Nx Polygraph"
              src="/images/enterprise/neurons-dark.avif"
              width={2111}
              height={921}
              className="hidden w-[48rem] max-w-none rounded-xl shadow-xl ring-1 ring-slate-400/10 sm:w-[57rem] md:-mr-4 lg:mr-0 dark:block"
            />
          </div>
          <div className="lg:ml-auto lg:pl-4 lg:pt-4">
            <div className="lg:max-w-lg">
              <SectionHeading as="p" variant="subtitle" className="mt-6">
                Get to market faster by avoiding the most common pitfall of
                growing teams: silos. Silos create waste, have poorly defined
                ownership, lack visibility - and slow everything down.
              </SectionHeading>
              <SectionHeading as="p" variant="subtitle" className="mt-4">
                Polygraph is a set of Nx Enterprise features built to help large
                organizations{' '}
                <Strong>
                  see across workspaces and take action to accelerate
                  time-to-market
                </Strong>
                .
              </SectionHeading>
              <figure className="mt-12 border-l border-slate-200 pl-8 dark:border-slate-800">
                <blockquote className="text-base/7">
                  <p>
                    “Nx means tooling and efficiency around our software
                    development lifecycle that empowers us to move a lot faster,
                    ship code faster and more reliably.”
                  </p>
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-x-4 text-sm/6">
                  <img
                    alt="Justin Schwartzenberger"
                    src="https://avatars.githubusercontent.com/u/1243236?v=4"
                    className="size-8 flex-none rounded-full"
                  />
                  <div>
                    <div className="font-semibold">Justin Schwartzenberger</div>
                    <div className="text-slate-500">
                      Principal Software Engineer, SiriusXM
                    </div>
                  </div>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-4xl sm:mt-20 lg:mt-24">
          <dl className="mx-auto mt-10 flex flex-col">
            <div className="group/section flex items-center gap-16">
              <div className="hidden shrink-0 p-6 sm:p-12 lg:block">
                <div className="relative grid size-12 place-items-center">
                  <EyeIcon
                    aria-hidden="true"
                    className="size-8 transition-all group-hover/section:-translate-x-2"
                  />
                  <DocumentMagnifyingGlassIcon
                    aria-hidden="true"
                    className="absolute inset-0 size-8 opacity-0 transition-all group-hover/section:-translate-y-2 group-hover/section:translate-x-8 group-hover/section:opacity-100"
                  />
                  <CodeBracketSquareIcon
                    aria-hidden="true"
                    className="absolute inset-0 size-8 opacity-0 transition-all group-hover/section:translate-x-7 group-hover/section:translate-y-6 group-hover/section:opacity-100"
                  />
                </div>
              </div>
              <div className="relative flex gap-x-4">
                <div className="absolute -bottom-6 left-0 top-0 flex w-6 justify-center">
                  <div className="w-px bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="relative mt-1 flex size-6 flex-none items-center justify-center bg-white dark:bg-slate-950">
                  <div className="size-1.5 rounded-full bg-slate-100 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600" />
                </div>
                <div className="flex flex-col pb-10">
                  <dt className="text-base font-semibold leading-7 text-black dark:text-white">
                    <div className="mb-6 flex">
                      <div className="rounded-lg bg-blue-500 px-2 py-0.5 font-semibold text-white dark:bg-white dark:text-black">
                        Visibility
                      </div>
                    </div>
                    See dependencies across teams and repos
                  </dt>
                  <dd className="mt-1 flex flex-auto flex-col text-base leading-7">
                    <p className="flex-auto">
                      In an organization with hundreds of repos it can be hard
                      to understand the relationships between different parts of
                      your ever-growing codebases. With the Workspace Graph, see
                      dependencies across all your repos to understand which
                      projects and teams are affected by changes in a single
                      repo.
                    </p>
                  </dd>
                </div>
              </div>
            </div>
            <div className="group/section flex items-center gap-16">
              <div className="hidden shrink-0 p-6 sm:p-12 lg:block">
                <div className="relative grid size-12 place-items-center">
                  <CheckBadgeIcon
                    aria-hidden="true"
                    className="size-8 transition-all group-hover/section:-translate-x-2"
                  />
                  <DocumentTextIcon
                    aria-hidden="true"
                    className="absolute inset-0 size-8 opacity-0 transition-all group-hover/section:-translate-y-2 group-hover/section:translate-x-8 group-hover/section:opacity-100"
                  />
                  <ArrowPathIcon
                    aria-hidden="true"
                    className="absolute inset-0 size-8 opacity-0 transition-all group-hover/section:translate-x-7 group-hover/section:translate-y-6 group-hover/section:opacity-100"
                  />
                </div>
              </div>
              <div className="group/section relative flex gap-x-4">
                <div className="absolute -bottom-6 left-0 top-0 flex w-6 justify-center">
                  <div className="w-px bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="relative mt-1 flex size-6 flex-none items-center justify-center bg-white dark:bg-slate-950">
                  <div className="size-1.5 rounded-full bg-slate-100 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600" />
                </div>
                <div className="flex flex-col pb-10">
                  <dt className="text-base font-semibold leading-7 text-black dark:text-white">
                    <div className="mb-6 flex">
                      <div className="rounded-lg bg-blue-500 px-2 py-0.5 font-semibold text-white dark:bg-white dark:text-black">
                        Conformance
                      </div>
                    </div>
                    Streamline onboarding and governance
                  </dt>
                  <dd className="mt-1 flex flex-auto flex-col text-base leading-7">
                    <p className="flex-auto">
                      Platform teams can easily publish and enforce coding
                      standards across an entire organization. Write and publish
                      rules, refactorings, and generators, then quickly deploy
                      them across all repos without involving individual teams.
                      Ensure security vulnerabilities are always addressed and
                      third-party dependencies stay up to date.{' '}
                      <i>
                        Included in{' '}
                        <Link
                          href="/powerpack"
                          title="Nx Powerpack"
                          prefetch={false}
                          className="underline"
                        >
                          Nx Powerpack
                        </Link>
                        , and available complimentary to all Enterprise
                        customers.
                      </i>
                    </p>
                    <ul className="mt-6 space-y-2 pl-4">
                      <li>
                        <Link
                          href="/ci/recipes/enterprise/conformance/configure-conformance-rules-in-nx-cloud"
                          prefetch={false}
                          title="Configure Conformance Rules"
                          className="text-sm/6 font-semibold"
                        >
                          Configure Conformance Rules{' '}
                          <span aria-hidden="true">→</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud"
                          prefetch={false}
                          title="Publish Conformance Rules"
                          className="text-sm/6 font-semibold"
                        >
                          Publish Conformance Rules{' '}
                          <span aria-hidden="true">→</span>
                        </Link>
                      </li>
                    </ul>
                  </dd>
                </div>
              </div>
            </div>
            <div className="group/section flex items-center gap-16">
              <div className="hidden shrink-0 p-6 sm:p-12 lg:block">
                <div className="relative grid size-12 place-items-center">
                  <UsersIcon
                    aria-hidden="true"
                    className="size-8 transition-all group-hover/section:-translate-x-2"
                  />
                  <AcademicCapIcon
                    aria-hidden="true"
                    className="absolute inset-0 size-8 opacity-0 transition-all group-hover/section:-translate-y-2 group-hover/section:translate-x-8 group-hover/section:opacity-100"
                  />
                  <ShieldExclamationIcon
                    aria-hidden="true"
                    className="absolute inset-0 size-8 opacity-0 transition-all group-hover/section:translate-x-8 group-hover/section:translate-y-6 group-hover/section:opacity-100"
                  />
                </div>
              </div>
              <div className="relative flex gap-x-4">
                <div className="absolute -bottom-6 left-0 top-0 flex w-6 justify-center">
                  <div className="w-px bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="relative mt-1 flex size-6 flex-none items-center justify-center bg-white dark:bg-slate-950">
                  <div className="size-1.5 rounded-full bg-slate-100 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600" />
                </div>
                <div className="flex flex-col pb-10">
                  <dt className="text-base font-semibold leading-7 text-black dark:text-white">
                    <div className="mb-6 flex">
                      <div className="rounded-lg bg-blue-500 px-2 py-0.5 font-semibold text-white dark:bg-white dark:text-black">
                        Ownership
                      </div>
                    </div>
                    Clear, expressive ownership
                  </dt>
                  <dd className="mt-1 flex flex-auto flex-col text-base leading-7">
                    <p className="flex-auto">
                      Unlike the code ownership tools from VCS providers, Nx
                      Owners is built for monorepos. Define ownership at the
                      project level. Nx will compile it back to the file-based
                      rules your VCS providers understand.
                    </p>
                    <p>
                      Polygraph lets you see owners across all your repositories
                      and plan out multi repo refactorings and migrations.{' '}
                      <i>
                        Included in{' '}
                        <Link
                          href="/powerpack"
                          title="Nx Powerpack"
                          className="underline"
                        >
                          Nx Powerpack
                        </Link>
                        , and available complimentary to all Enterprise
                        customers.
                      </i>
                    </p>
                  </dd>
                </div>
              </div>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export function ScaleOrganizationIntro(): ReactElement {
  return (
    <section className="relative isolate px-6 py-24 sm:py-32 lg:px-8">
      <svg
        focusable={false}
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full stroke-black/10 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)] dark:stroke-white/20"
      >
        <defs>
          <pattern
            id="1d4240dd-898f-445f-932d-e2872fd12de3"
            width={200}
            height={200}
            x="50%"
            y={0}
            patternUnits="userSpaceOnUse"
          >
            <path d="M.5 200V.5H200" fill="none" />
          </pattern>
        </defs>
        <svg
          x="50%"
          y={0}
          className="overflow-visible fill-slate-200/20 dark:fill-slate-800/60"
        >
          <path
            d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
            strokeWidth={0}
          />
        </svg>
        <rect
          width="100%"
          height="100%"
          strokeWidth={0}
          fill="url(#1d4240dd-898f-445f-932d-e2872fd12de3)"
        />
      </svg>
      <div className="mx-auto max-w-5xl text-center">
        <SectionHeading as="h2" variant="title" id="scale-your-organization">
          Don’t lose velocity as your organization grows{' '}
          <br className="xl:block" />
          <span className="line-through">10x developer</span>{' '}
          <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            Nx developers are even more efficient at scale
          </span>
        </SectionHeading>
      </div>
    </section>
  );
}
