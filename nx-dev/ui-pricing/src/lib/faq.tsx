'use client';
import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { FAQPageJsonLd } from 'next-seo';
import Link from 'next/link';
import { ReactElement } from 'react';

export function Faq(): ReactElement {
  const faqs = [
    {
      question: 'What are credits?',
      answer:
        'Credits are the currency of Nx Cloud. A determined number of credits are included in each plan. These credits are used to pay for Nx Cloud platform usage in real time.',
    },
    {
      question: 'How much does it cost per individual credit?',
      answer:
        "On the Team Plan, each credit costs $0.00055, which is $5.50 for 10,000 credits to help you visualize the pricing. However, you don't need to purchase credits in fixed amounts—we only charge you for the exact number of additional credits you use beyond your included credits. Overages are prorated, so you'll only pay for what you actually consume.",
    },
    {
      question: 'Do included credits expire?',
      answer:
        'Credits expire at the end of the billing cycle and do not roll over.',
    },
    {
      question: 'When does the billing cycle start and end?',
      answer:
        'A new billing cycle starts on the first day of every month. If you go over the Hobby plan limit during a cycle your organization will be disabled. You will have to upgrade to our Pro plan or wait for the next billing cycle.',
    },
    {
      question: 'What is an active contributor?',
      answer:
        'Active contributors are calculated based on any person or actor that has triggered a CI Pipeline Execution within the current billing cycle.',
    },
    {
      question: 'What is a concurrent connection?',
      answer:
        'Concurrent connections are unique machines that connect to Nx Cloud from a CI environment. If you are using Distributed Task Execution, you should expect to have one concurrent connection from your orchestrator job, and one additional concurrent connection for each live agent that is helping perform work.',
    },
    {
      question:
        'Is there a limit to the number of active contributors I can have on the Hobby plan?',
      answer:
        'Our free Hobby Plan is only limited by the number of credits you can use per month. This means you can use it free, forever, no matter your team size, as long as your use falls below 50,000 credits/month. This makes it ideal for small-scale projects or for larger teams looking to test out a proof of concept. For those larger teams, we offer the Team Plan which includes 5 active contributors at no cost and offers the flexibility to add even more contributors, concurrencies, and credits to fit the unique needs of each team. ',
    },
    {
      question: 'Do I need a credit card to create an account?',
      answer:
        'No, you can set up a workspace with Nx Cloud completely for free, without entering any billing information.',
    },
    {
      question:
        'What happens if I consume all my credits while on the Hobby plan?',
      answer:
        'The Hobby plan allows you to configure and run a small project at no cost. If you consume all the credits, your organization will be disabled until you upgrade to Pro or wait for the next billing cycle.',
    },
    {
      question: 'What is a CI Pipeline Execution?',
      answer:
        'By default, a CI pipeline execution is a 1:1 match to your CI provider of choice\'s concept of a "workflow".',
    },
    {
      question: 'What is the Team Plan?',
      answer:
        'The Team Plan is our new offering that provides flexible pricing, designed to better meet the needs of teams of all sizes. The Team Plan replaced the Pro Plan in 2024. ',
    },
    {
      question: 'How does the Team Plan differ from the previous Pro Plan?',
      answer:
        'The Team Plan offers a lower base price with the ability to add contributors and credits as needed, whereas the Pro Plan had a higher base price with fixed allowances.',
    },
    {
      question:
        'I think I am on the Pro Plan but don’t see it offered, does it still exist?',
      answer:
        'Existing Pro Plan users have been grandfathered into their existing plan and can expect no changes. This plan is no longer available to new users. ',
    },
    {
      question: 'Can existing Pro organizations switch to the new Team Plan?',
      answer:
        'Yes! If the new Team Plan better fits your needs, you can reach out to cloud-support@nrwl.io. If you upgrade to a new plan, please note that you will not be able to switch back to a legacy plan. ',
    },
    {
      question: 'Is there a plan for open source projects?',
      answer:
        'Yes, we are happy to collaborate with open source projects. Please complete this form, and we will review your request and get back to you: https://nx.dev/pricing/special-offer',
    },
    {
      question: 'What if I need help picking the right plan?',
      answer:
        'We have a helpful comparison above. If you have additional questions, or these plans don’t fit your needs please reach out to https://nx.dev/contact/sales and we will do our best to help.',
    },
    {
      question: 'What if I need more than 70 active contributors?',
      answer: 'Please reach out to https://nx.dev/contact/sales',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept Visa, Mastercard, American Express, and Discover from customers worldwide.',
    },
  ];

  return (
    <section id="faq">
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
                Can’t find the answer you’re looking for?
              </Link>
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
