'use client';
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { FAQPageJsonLd } from 'next-seo';
import Link from 'next/link';
import { ReactElement } from 'react';

export function SolutionsFaq(): ReactElement {
  const faqs = [
    {
      question: 'What is Nx?',
      answerJson:
        'Nx is a smart build system and task orchestrator that understands how your code is built, used, and shared. It helps teams scale confidently by running only what’s needed, enforcing best practices, and keeping builds fast and reliable—both locally and in CI. Nx also structures your metadata to power consistent, AI-assisted workflows across your entire development pipeline.',
      answerUi: (
        <p>
          Nx is a smart build system and task orchestrator that understands how
          your code is built, used, and shared. It helps teams scale confidently
          by running only what’s needed, enforcing best practices, and keeping
          builds fast and reliable—both locally and in CI. Nx also structures
          your metadata to power consistent, AI-assisted workflows across your
          entire development pipeline.
        </p>
      ),
    },
    {
      question: 'Do I need to migrate to Nx all at once?',
      answerJson:
        'Not at all. Nx can be incrementally adopted. You can start with just your team — and expand at your own pace.',
      answerUi: (
        <>
          <p>
            Not at all. Nx can be incrementally adopted. You can start with just
            your team — and expand at your own pace.
          </p>
        </>
      ),
    },
    {
      question: 'Will Nx work with our current CI provider and tooling?',
      answerJson:
        'Yes. Nx integrates with all the major CI providers (GitHub Actions, CircleCI, GitLab, Azure, Bitbucket and Jenkins) and fits into your existing developer toolchain. You can easily get started with your existing stack.',
      answerUi: (
        <p>
          Yes. Nx integrates with all the major CI providers (GitHub Actions,
          CircleCI, GitLab, Azure, Bitbucket and Jenkins) and fits into your
          existing developer toolchain. You can easily get started with your
          existing stack.
        </p>
      ),
    },
    {
      question: 'Is Nx just for monorepos?',
      answerJson:
        'No. While Nx is well known in the monorepo community, it works just as well in polyrepo environments. Features like remote caching, dependency graphing, and conformance enforcement are valuable in any repo structure.',
      answerUi: (
        <p>
          No. While Nx is well known in the monorepo community, it works just as
          well in polyrepo environments. Features like remote caching,
          dependency graphing, and conformance enforcement are valuable in any
          repo structure.
        </p>
      ),
    },
  ];

  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          <header>
            <SectionHeading as="h2" variant="title">
              Have questions?
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Got questions? We've got answers.
            </SectionHeading>

            <p className="text-md mt-4 text-slate-400 dark:text-slate-600">
              <Link
                href="/contact"
                title="Reach out to the team"
                className="font-semibold"
              >
                If you don't find what you're looking for, feel free to reach
                out.
              </Link>
            </p>
          </header>
          <FAQPageJsonLd
            useAppDir={true}
            mainEntity={faqs.map((faq) => ({
              questionName: faq.question,
              acceptedAnswerText: faq.answerJson,
            }))}
          />
          <div className="mt-12 lg:col-span-2 lg:mt-0">
            <dl className="mt-6 space-y-6 divide-y divide-slate-100 dark:divide-slate-800">
              {faqs.map((faq) => (
                <Disclosure as="div" key={faq.question} className="pt-6">
                  {({ open }) => (
                    <>
                      <dt className="text-lg">
                        <DisclosureButton className="flex w-full items-start justify-between text-left text-slate-400">
                          <span className="font-medium text-slate-800 dark:text-slate-300">
                            {faq.question}
                          </span>
                          <span className="ml-6 flex h-7 items-center">
                            <ChevronDownIcon
                              className={cx(
                                open ? '-rotate-180' : 'rotate-0',
                                'h-6 w-6 transform transition-transform'
                              )}
                              aria-hidden="true"
                            />
                          </span>
                        </DisclosureButton>
                      </dt>
                      <Transition
                        enter="transition duration-100 ease-out"
                        enterFrom="transform -translate-y-6 opacity-0"
                        enterTo="transform translate-y-0 opacity-100"
                        leave="transition duration-75 ease-out"
                        leaveFrom="transform translate-y-0 opacity-100"
                        leaveTo="transform -translate-y-6 opacity-0"
                      >
                        <DisclosurePanel
                          as="dd"
                          className="mt-2 pr-12 text-base text-slate-500 dark:text-slate-400"
                        >
                          {faq.answerUi}
                        </DisclosurePanel>
                      </Transition>
                    </>
                  )}
                </Disclosure>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
