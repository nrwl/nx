'use client';
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { FAQPageJsonLd } from 'next-seo';
import Link from 'next/link';
import { ReactElement } from 'react';

export function Faq(): ReactElement {
  const faqs = [
    {
      question: 'How is a key different than the license?',
      answerJson:
        'Unlike a license, which outlined a commercial relationship between the code consumer and us, the key simply provides a free mechanism for us to gather insights into how our tools are used.',
      answerUi: (
        <p>
          Unlike a license, which outlined a commercial relationship between the
          code consumer and us, the key simply provides a free mechanism for us
          to gather insights into how our tools are used.
        </p>
      ),
    },
    {
      question:
        'I was using custom runners or a DIY self-hosted caching solution. What should I do?',
      answerJson:
        "It's important to note that not all custom task runner use-cases were caching related. If you want to execute some code before or after tasks are executed, we have a new API for you to leverage which is documented here: https://nx.dev/deprecated/custom-tasks-runner#deprecating-custom-tasks-runner.\n If you were leveraging the custom tasks runners API to facilitate remote caching then you now have the choice between the three remote caching options outlined on this page: Nx Cloud, Self-Hosted via Nx Plugins, and Self-Hosted via your own OpenAPI server.",
      answerUi: (
        <>
          <p>
            It's important to note that not all custom task runner use-cases
            were caching related. If you want to execute some code before or
            after tasks are executed, we have a new API for you to leverage
            which is{' '}
            <Link
              href="/deprecated/custom-tasks-runner#deprecating-custom-tasks-runner"
              title="See documentation"
              prefetch={false}
              className="font-semibold"
            >
              documented here.
            </Link>
          </p>
          <p>
            If you were leveraging the custom tasks runners API to facilitate
            remote caching then you now have the choice between the three remote
            caching options outlined on this page: Nx Cloud, Self-Hosted via Nx
            Plugins, and Self-Hosted via your own OpenAPI server.
          </p>
        </>
      ),
    },
    {
      question:
        'How do I implement custom authentication for my self-hosted cache?',
      answerJson:
        'You implement custom authentication by using our OpenAPI solution',
      answerUi: (
        <p>
          We have an OpenAPI spec to implement your own remote caching server,
          thus giving you the flexibility to adapt it to your custom
          authentication requirements.{' '}
          <Link
            href="/recipes/running-tasks/self-hosted-caching#build-your-own-caching-server"
            title="Learn more"
            prefetch={false}
            className="font-semibold"
          >
            Learn more here.
          </Link>
        </p>
      ),
    },
    {
      question:
        'What cache poisoning vulnerabilities affect self-hosted solutions?',
      answerJson:
        'CREEP (Cache Race-condition Exploit Enables Poisoning) is a critical vulnerability (CVE-2025-36852) that affects self-hosted remote cache solutions. <br /> It allows any developer with pull request access to inject malicious code into your production builds through a race condition in the caching system. The attack is undetectable because it happens during artifact creation, before any security measures take effect.',
      answerUi: (
        <p>
          CREEP (Cache Race-condition Exploit Enables Poisoning) is a critical
          vulnerability (CVE-2025-36852) that affects self-hosted remote cache
          solutions. <br /> It allows any developer with pull request access to
          inject malicious code into your production builds through a race
          condition in the caching system. The attack is undetectable because it
          happens during artifact creation, before any security measures take
          effect.{' '}
          <Link
            href="/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep"
            title="Learn more"
            prefetch={false}
            className="font-semibold"
          >
            Learn more here.
          </Link>
        </p>
      ),
    },
    {
      question: 'Is my self-hosted cache setup secure enough?',
      answerJson:
        'Most self-hosted cache setups offer basic functionality but lack critical security features. Without enforced input validation, branch isolation, and real-time access control, self-hosted caches are vulnerable to cache poisoning, where compromised or unverified artifacts can silently pollute your builds. We recommend using Nx Cloud, which provides infrastructure-level protections, making it a safer choice for organizations in highly regulated industries.',
      answerUi: (
        <p>
          Most self-hosted cache setups offer basic functionality but lack
          critical security features. Without enforced input validation, branch
          isolation, and real-time access control, self-hosted caches are
          vulnerable to cache poisoning, where compromised or unverified
          artifacts can silently pollute your builds. We recommend using Nx
          Cloud, which provides infrastructure-level protections, making it a
          safer choice for organizations in highly regulated industries.{' '}
          <Link
            href="/enterprise/security"
            title="Learn more"
            prefetch={false}
            className="font-semibold"
          >
            Learn more here.
          </Link>
        </p>
      ),
    },
    {
      question:
        'What security measures does Nx Cloud offer beyond the official plugins and third party plugins?',
      answerJson:
        'Nx Cloud includes enterprise-grade security features designed to give organizations more control over access and data protection:\n\n' +
        '- Access Management: Nx Cloud supports **individual user authentication tied to personal accounts, enabling precise control over who can access cached data. If a user leaves the company or changes roles, their access can be revoked immediately — without impacting others.\n' +
        '- Personal Access Tokens: Teams can issue and revoke multiple access tokens, allowing fine-grained control over automation and integrations.\n' +
        '- No Cache Overrides: Nx Cloud prevents unauthorized cache modifications.\n' +
        '- SOC 2 Compliance: Nx Cloud is SOC 2 certified, demonstrating a high standard for security, availability, and confidentiality.\n' +
        '- Secure Deployment Options: Nx Cloud though Nx Enterprise, includes single-tenant or on-prem options for teams needing full control over their data storage and access policies.',
      answerUi: (
        <>
          <p>
            Nx Cloud includes enterprise-grade security features designed to
            give organizations more control over access and data protection.
          </p>
          <ul className="mt-4 list-disc space-y-2 px-4">
            <li>
              Access Management: Nx Cloud supports individual user
              authentication tied to personal accounts, enabling precise control
              over who can access cached data. If a user leaves the company or
              changes roles, their access can be revoked immediately — without
              impacting others.
            </li>
            <li>
              Personal Access Tokens: Teams can issue and revoke multiple access
              tokens, allowing fine-grained control over automation and
              integrations.
            </li>
            <li>
              No Cache Overrides: Nx Cloud prevents unauthorized cache
              modifications.
            </li>
            <li>
              SOC 2 Compliance Nx Cloud is SOC 2 certified, demonstrating a high
              standard for security, availability, and confidentiality.
            </li>
            <li>
              Secure Deployment Options Nx Cloud though Nx Enterprise includes{' '}
              single-tenant or on-prem options for teams needing full control
              over their data storage and access policies.
            </li>
          </ul>
        </>
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
