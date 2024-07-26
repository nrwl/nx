'use client';
import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { FAQPageJsonLd } from 'next-seo';

export function Faq(): JSX.Element {
  const faqs = [
    {
      question: 'What are credits?',
      answer:
        'Credits are the currency of Nx Cloud. A determined number of credits are included in each plan. These credits are used to pay for Nx Cloud platform usage in real time.',
    },
    {
      question: 'Do credits expire?',
      answer:
        'Credits expire at the end of the billing cycle and do not roll over.',
    },
    {
      question: 'When does the billing cycle start and end?',
      answer:
        'A new billing cycle starts on the first day of every month. If you go over the Hobby plan limit during a cycle your organization will be disabled. You will have to upgrade to our Pro plan or wait for the next billing cycle.',
    },
    {
      question: 'What is a CI Pipeline Execution (CIPE)?',
      answer:
        'By default, a CI pipeline execution is a 1:1 match to your CI provider of choice\'s concept of a "workflow".',
    },
    {
      question: 'What is the concurrency connections limit?',
      answer:
        'As you scale your usage of Nx Cloud, you may run into concurrency limits. Nx Cloud puts a limit on the number of CI machines in your workspace that are simultaneously connecting to Nx Cloud. This includes any machine running in CI - both the main CI pipeline machine and any agent machines.',
    },
    {
      question: 'What is a contributor?',
      answer:
        "A contributor is a person who has committed to your repository. Your organization's contributor count is calculated from anonymized, monthly git histories across all the workspaces in your Nx Cloud organization.",
    },
    {
      question: "What if I exceed my plan's contributor limit?",
      answer:
        'If you exceed the contributor limit, your organization will be disabled until you upgrade to a plan that supports the number of contributors you have.',
    },
    {
      question:
        'What happens if I consume all my credits while on the Hobby plan?',
      answer:
        'The Hobby plan allows you to configure and run a small project at no cost. If you consume all the credits, your organization will be disabled until you upgrade to Pro or wait for the next billing cycle.',
    },
    {
      question: 'Can I upgrade my Hobby plan to the Pro plan?',
      answer:
        'Yes, you can upgrade your Hobby plan to the Pro plan at any time.',
    },
    {
      question: 'Is there a plan for open source projects?',
      answer:
        'Yes, we are happy to collaborate with open source projects. Please complete this form, and we will review your request and get back to you: https://nx.dev/pricing/special-offer',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept Visa, Mastercard, American Express, and Discover from customers worldwide.',
    },
    {
      question: 'Do I need a credit card to create an account?',
      answer:
        'No, you can set up a workspace with Nx Cloud completely for free, without entering any billing information.',
    },
  ];

  return (
    <section id="faq">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          <header>
            <SectionHeading as="h2" variant="title">
              Not sure yet? <br /> Have questions?
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Here are the most asked question we condensed for your to get you
              setup quickly.
            </SectionHeading>

            <p className="text-md mt-4 text-slate-400 dark:text-slate-600">
              Can’t find the answer you’re looking for? Reach out to our{' '}
              <a
                href="mailto:cloud-support@nrwl.io"
                className="font-medium underline"
              >
                customer support
              </a>{' '}
              team.
            </p>
          </header>
          <FAQPageJsonLd
            useAppDir={true}
            mainEntity={faqs.map((faq) => ({
              questionName: faq.question,
              acceptedAnswerText: faq.answer,
            }))}
          />
          <div className="mt-12 lg:col-span-2 lg:mt-0">
            <dl className="mt-6 space-y-6 divide-y divide-slate-100 dark:divide-slate-800">
              {faqs.map((faq) => (
                <Disclosure as="div" key={faq.question} className="pt-6">
                  {({ open }) => (
                    <>
                      <dt className="text-lg">
                        <Disclosure.Button className="flex w-full items-start justify-between text-left text-slate-400">
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
                        </Disclosure.Button>
                      </dt>
                      <Transition
                        enter="transition duration-100 ease-out"
                        enterFrom="transform -translate-y-6 opacity-0"
                        enterTo="transform translate-y-0 opacity-100"
                        leave="transition duration-75 ease-out"
                        leaveFrom="transform translate-y-0 opacity-100"
                        leaveTo="transform -translate-y-6 opacity-0"
                      >
                        <Disclosure.Panel as="dd" className="mt-2 pr-12">
                          <p className="text-base text-slate-500 dark:text-slate-400">
                            {faq.answer}
                          </p>
                        </Disclosure.Panel>
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
