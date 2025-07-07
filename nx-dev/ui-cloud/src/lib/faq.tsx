'use client';
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import { cx } from '@nx/nx-dev-ui-primitives';
import { FAQPageJsonLd } from 'next-seo';
import Link from 'next/link';
import { ReactElement } from 'react';

export function Faq(): ReactElement {
  const faqs = [
    {
      question: 'Will Nx Cloud work with my existing CI setup?',
      answerJson:
        "Yes! Nx Cloud works with any CI provider - GitHub Actions, CircleCI, Jenkins, GitLab CI, etc. It's a 5-minute setup that augments your existing pipeline without replacing it.",
      answerUi: (
        <p>
          Yes! Nx Cloud works with any CI provider - GitHub Actions, CircleCI,
          Jenkins, GitLab CI, etc. It's a 5-minute setup that augments your
          existing pipeline without replacing it.
        </p>
      ),
    },
    {
      question: 'How quickly will I see results?',
      answerJson:
        'Immediately. Most teams see 50-90% faster builds on day one. The self-healing features eliminate flaky test interruptions right away.',
      answerUi: (
        <>
          <p>
            Immediately. Most teams see 50-90% faster builds on day one. The
            self-healing features eliminate flaky test interruptions right away.
          </p>
        </>
      ),
    },
    {
      question: 'Is my code secure?',
      answerJson:
        "Absolutely. We're SOC 2 Type II certified with end-to-end encryption. Your source code never leaves your infrastructure - we only cache build artifacts. Enterprise customers can also deploy on-premise.",
      answerUi: (
        <p>
          Absolutely. We're SOC 2 Type II certified with end-to-end encryption.
          Your source code never leaves your infrastructure - we only cache
          build artifacts. Enterprise customers can also deploy on-premise.
        </p>
      ),
    },
    {
      question: 'What are credits?',
      answerJson:
        'Credits are the currency of Nx Cloud. A determined number of credits are included in each plan. These credits are used to pay for Nx Cloud platform usage in real time.',
      answerUi: (
        <p>
          Credits are the currency of Nx Cloud. A determined number of credits
          are included in each plan. These credits are used to pay for Nx Cloud
          platform usage in real time.
        </p>
      ),
    },
    {
      question: 'How much does it cost per individual credit?',
      answerJson:
        "On the Team Plan, each credit costs $0.00055, which is $5.50 for 10,000 credits to help you visualize the pricing. However, you don't need to purchase credits in fixed amounts—we only charge you for the exact number of additional credits you use beyond your included credits. Overages are prorated, so you'll only pay for what you actually consume.",
      answerUi: (
        <p>
          On the Team Plan, each credit costs $0.00055, which is $5.50 for
          10,000 credits to help you visualize the pricing. However, you don't
          need to purchase credits in fixed amounts—we only charge you for the
          exact number of additional credits you use beyond your included
          credits. Overages are prorated, so you'll only pay for what you
          actually consume.
        </p>
      ),
    },
    {
      question: 'Do included credits expire?',
      answerJson:
        'Credits expire at the end of the billing cycle and do not roll over.',
      answerUi: (
        <p>
          Credits expire at the end of the billing cycle and do not roll over.
        </p>
      ),
    },
    {
      question: 'When does the billing cycle start and end?',
      answerJson:
        'A new billing cycle starts on the first day of every month. If you go over the Hobby plan limit during a cycle your organization will be disabled. You will have to upgrade to our Pro plan or wait for the next billing cycle.',
      answerUi: (
        <p>
          A new billing cycle starts on the first day of every month. If you go
          over the Hobby plan limit during a cycle your organization will be
          disabled. You will have to upgrade to our Pro plan or wait for the
          next billing cycle.
        </p>
      ),
    },
    {
      question: 'What is an active contributor?',
      answerJson:
        'Active contributors are calculated based on any person or actor that has triggered a CI Pipeline Execution within the current billing cycle.',
      answerUi: (
        <p>
          Active contributors are calculated based on any person or actor that
          has triggered a CI Pipeline Execution within the current billing
          cycle.
        </p>
      ),
    },
    {
      question: 'What is a concurrent connection?',
      answerJson:
        'Concurrent connections are unique machines that connect to Nx Cloud from a CI environment. If you are using Distributed Task Execution, you should expect to have one concurrent connection from your orchestrator job, and one additional concurrent connection for each live agent that is helping perform work.',
      answerUi: (
        <p>
          Concurrent connections are unique machines that connect to Nx Cloud
          from a CI environment. If you are using Distributed Task Execution,
          you should expect to have one concurrent connection from your
          orchestrator job, and one additional concurrent connection for each
          live agent that is helping perform work.
        </p>
      ),
    },
    {
      question:
        "I thought I was on the Pro plan, but I don't see it listed anymore. Does it still exist?",
      answerJson:
        "Yes, the Pro plan still exists for users who were grandfathered in. If you're already on the Pro plan, you will continue to receive support without any changes. However, this plan is no longer available to new users.",
      answerUi: (
        <p>
          Yes, the Pro plan still exists for users who were grandfathered in. If
          you're already on the Pro plan, you will continue to receive support
          without any changes. However, this plan is no longer available to new
          users.
        </p>
      ),
    },
    {
      question:
        'Is there a limit to the number of active contributors I can have on the Hobby plan?',
      answerJson:
        'Our free Hobby Plan is only limited by the number of credits you can use per month. This means you can use it free, forever, no matter your team size, as long as your use falls below 50,000 credits/month. This makes it ideal for small-scale projects or for larger teams looking to test out a proof of concept. For those larger teams, we offer the Team Plan which includes 5 active contributors at no cost and offers the flexibility to add even more contributors, concurrencies, and credits to fit the unique needs of each team. ',
      answerUi: (
        <>
          <p>
            Our free Hobby Plan is only limited by the number of credits you can
            use per month. This means you can use it free, forever, no matter
            your team size, as long as your use falls below 50,000
            credits/month. This makes it ideal for small-scale projects or for
            larger teams looking to test out a proof of concept.
          </p>
          <p className="mt-4">
            For those larger teams, we offer the Team Plan which includes 5
            active contributors at no cost and offers the flexibility to add
            even more contributors, concurrencies, and credits to fit the unique
            needs of each team.
          </p>
        </>
      ),
    },
    {
      question: 'Do I need a credit card to create an account?',
      answerJson:
        'No, you can set up a workspace with Nx Cloud completely for free, without entering any billing information.',
      answerUi: (
        <p>
          No, you can set up a workspace with Nx Cloud completely for free,
          without entering any billing information.
        </p>
      ),
    },
    {
      question:
        'What happens if I consume all my credits while on the Hobby plan?',
      answerJson:
        'The Hobby plan allows you to configure and run a small project at no cost. If you consume all the credits, your organization will be disabled until you upgrade to Team or wait for the next billing cycle.',
      answerUi: (
        <p>
          The Hobby plan allows you to configure and run a small project at no
          cost. If you consume all the credits, your organization will be
          disabled until you upgrade to Team or wait for the next billing cycle.
        </p>
      ),
    },
    {
      question: 'What is a CI Pipeline Execution?',
      answerJson:
        'A CI Pipeline Execution is a CI run or a Workflow run (depending on your CI provider). For instance, running a PR or running CI on the main branch are CI Pipeline Executions.',
      answerUi: (
        <p>
          A CI Pipeline Execution is a CI run or a Workflow run (depending on
          your CI provider). For instance, running a PR or running CI on the
          main branch are CI Pipeline Executions.
        </p>
      ),
    },
    {
      question: 'What is the Team Plan?',
      answerJson:
        'The Team Plan is our new offering that provides flexible pricing, designed to better meet the needs of teams of all sizes. The Team Plan replaced the Pro Plan in 2024. ',
      answerUi: (
        <p>
          The Team Plan is our new offering that provides flexible pricing,
          designed to better meet the needs of teams of all sizes. The Team Plan
          replaced the Pro Plan in 2024.
        </p>
      ),
    },
    {
      question: 'How does the Team Plan differ from the previous Pro Plan?',
      answerJson:
        'The Team Plan offers a lower base price with the ability to add contributors and credits as needed, whereas the Pro Plan had a higher base price with fixed allowances.',
      answerUi: (
        <p>
          The Team Plan offers a lower base price with the ability to add
          contributors and credits as needed, whereas the Pro Plan had a higher
          base price with fixed allowances.
        </p>
      ),
    },
    {
      question:
        'I think I am on the Pro Plan but don’t see it offered, does it still exist?',
      answerJson:
        'Existing Pro Plan users have been grandfathered into their existing plan and can expect no changes. This plan is no longer available to new users. ',
      answerUi: (
        <p>
          Existing Pro Plan users have been grandfathered into their existing
          plan and can expect no changes. This plan is no longer available to
          new users.
        </p>
      ),
    },
    {
      question: 'Can existing Pro organizations switch to the new Team Plan?',
      answerJson:
        'Yes! If the new Team Plan better fits your needs, you can reach out to cloud-support@nrwl.io. If you upgrade to a new plan, please note that you will not be able to switch back to a legacy plan. ',
      answerUi: (
        <p>
          Yes! If the new Team Plan better fits your needs, you can reach out to
          cloud-support@nrwl.io. If you upgrade to a new plan, please note that
          you will not be able to switch back to a legacy plan.
        </p>
      ),
    },
    {
      question: 'Is there a plan for open source projects?',
      answerJson:
        'Yes, we are happy to collaborate with open source projects. Please complete this form, and we will review your request and get back to you: https://nx.dev/pricing/special-offer',
      answerUi: (
        <p>
          Yes, we are happy to collaborate with open source projects. Please
          complete this form, and we will review your request and get back to
          you:{' '}
          <Link
            href="/pricing/special-offer"
            title="Special offer"
            className="underline"
          >
            https://nx.dev/pricing/special-offer
          </Link>
        </p>
      ),
    },
    {
      question: 'What if I need help picking the right plan?',
      answerJson:
        'We have a helpful comparison above. If you have additional questions, or these plans don’t fit your needs please reach out to https://nx.dev/contact/sales and we will do our best to help.',
      answerUi: (
        <p>
          We have a helpful comparison above. If you have additional questions,
          or these plans don’t fit your needs please reach out to
          https://nx.dev/contact/sales and we will do our best to help.
        </p>
      ),
    },
    {
      question: 'What if I need more than 30 active contributors?',
      answerJson: 'Please reach out to https://nx.dev/contact/sales',
      answerUi: (
        <p>
          Please reach out to{' '}
          <Link href="/contact/sales" title="Contact us" className="underline">
            https://nx.dev/contact/sales
          </Link>
        </p>
      ),
    },
    {
      question: 'What payment methods do you accept?',
      answerJson:
        'We accept Visa, Mastercard, American Express, and Discover from customers worldwide.',
      answerUi: (
        <p>
          We accept Visa, Mastercard, American Express, and Discover from
          customers worldwide.
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
