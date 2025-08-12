'use client';
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { SectionHeading, Strong } from '@nx/nx-dev-ui-common';
import { cx } from '@nx/nx-dev-ui-primitives';
import { FAQPageJsonLd } from 'next-seo';
import Link from 'next/link';
import { ReactElement } from 'react';

export function Faq(): ReactElement {
  const faqs = [
    {
      question: 'Does Nx Powerpack activation require network access?',
      answerJson:
        'If you enable Nx Powerpack without Nx Cloud, no network requests will be created and no data will be collected.',
      answerUi: (
        <p>
          If you enable Nx Powerpack without Nx Cloud, no network requests will
          be created and no data will be collected.
        </p>
      ),
    },
    {
      question: 'Can I get an Nx Powerpack license for free?',
      answerJson:
        'Open source projects can get Powerpack for free, and small teams can get a remote cache only license for free. All licenses are perpetual and licenses can be updated as long as the organization still qualifies.',
      answerUi: (
        <p>
          Open source projects can get Powerpack for free, and small teams can
          get a remote cache only license for free. All licenses are perpetual
          and licenses can be updated as long as the organization still
          qualifies.
        </p>
      ),
    },
    {
      question: 'How do we define a small team?',
      answerJson:
        'We value small teams using Nx. That is why we provide a free, perpetual, remote cache only license to any company with fewer than 30 engineers using Nx. If you have a special case, reach out and we will help. Read more here: https://nx.dev/nx-enterprise/powerpack/free-licenses-and-trials',
      answerUi: (
        <p>
          We value small teams using Nx. That is why we provide a free,
          perpetual, remote cache only license to any company with fewer than 30
          engineers using Nx. If you have a special case, reach out and we will
          help.
          <Link
            href="https://nx.dev/nx-enterprise/powerpack/free-licenses-and-trials"
            title="Free licenses and trials"
            className="font-semibold"
          >
            Read more here.
          </Link>
        </p>
      ),
    },
    {
      question: 'What can a large team do?',
      answerJson:
        'You can get a trial license immediately. Read more here: https://nx.dev/nx-enterprise/powerpack/free-licenses-and-trials',
      answerUi: (
        <p>
          You can get a trial license immediately.{' '}
          <Link
            href="https://nx.dev/nx-enterprise/powerpack/free-licenses-and-trials"
            title="Free licenses and trials"
            className="font-semibold"
          >
            Read more here.
          </Link>
        </p>
      ),
    },
    {
      question: 'Want to use Powerpack for OSS?',
      answerJson:
        'You can get Powerpack for free for your open source projects. Learn more in the docs: https://nx.dev/nx-enterprise/powerpack/licenses-and-trials#powerpack-for-oss-projects',
      answerUi: (
        <p>
          You can get Powerpack for free for your open source projects.{' '}
          <Link
            href="https://nx.dev/nx-enterprise/powerpack/licenses-and-trials#powerpack-for-oss-projects"
            title="Powerpack for OSS projects"
            className="font-semibold"
          >
            Learn more about it in our docs.
          </Link>
        </p>
      ),
    },
    {
      question:
        'Only interested in Nx Powerpack because of Custom Tasks Runner deprecation',
      answerJson:
        'We created a transition path from using Custom Tasks Runners to using the new plugins api hooks (preTasksExecution and postTasksExectution) and Nx Powerpack. Read more here: https://nx.dev/deprecated/custom-tasks-runner',
      answerUi: (
        <p>
          We created a transition path from using Custom Tasks Runners to using
          the new plugins api hooks (preTasksExecution and postTasksExectution)
          and Nx Powerpack.{' '}
          <Link
            href="https://nx.dev/deprecated/custom-tasks-runner"
            title="Custom Tasks Runner deprecation"
            className="font-semibold"
          >
            Read more here.
          </Link>
        </p>
      ),
    },
    {
      question: 'Is Nx Powerpack license perpetual?',
      answerJson:
        'Yes. The most recent version of Nx you can access while your license is still active will remain usable even after the license expires.',
      answerUi: (
        <p>
          <Strong>Yes</Strong>. The most recent version of Nx you can access
          while your license is still active will remain usable even after the
          license expires.
        </p>
      ),
    },
    {
      question: 'Do Nx Enterprise customers have access to Nx Powerpack?',
      answerJson:
        'Nx Powerpack is provided at no additional cost for Nx Enterprise customers. Your DPE can help you get maximum value out of Nx Powerpack packages.',
      answerUi: (
        <p>
          Nx Powerpack is provided at <Strong>no additional cost</Strong> for Nx
          Enterprise customers. Your DPE can help you get maximum value out of
          Nx Powerpack packages.
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
              Check out our most commonly asked questions.
            </SectionHeading>

            <p className="text-md mt-4 text-slate-400 dark:text-slate-600">
              <Link
                href="/contact"
                title="Reach out to the team"
                className="font-semibold"
              >
                Can't find the answer you're looking for?
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
