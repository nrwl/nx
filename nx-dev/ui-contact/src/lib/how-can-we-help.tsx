import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import {
  ArrowUpRightIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

export function HowCanWeHelp(): JSX.Element {
  return (
    <section id="contact-us">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h1" variant="display" id="how-can-we-help">
            How can we help?
          </SectionHeading>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          <section className="rounded-xl border border-slate-200 bg-slate-50/20 p-8 dark:border-slate-800/40 dark:bg-slate-800/60">
            <div className="flex gap-2 items-center">
              <ChatBubbleLeftRightIcon
                aria-hidden="true"
                className="shrink-0 w-5 h-5"
              />
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">
                Question about Nx
              </h3>
            </div>
            <p className="mt-4">
              Ask a question, need guidance, talk new ideas or simply leave
              feedback about our products on the Discord channel.
            </p>
            <ButtonLink
              href="https://go.nx.dev/community"
              variant="secondary"
              size="default"
              title="Join the community"
              target="_blank"
              rel="nofollow"
              className="mt-6"
            >
              <span>Ask questions on Discord</span>
              <ArrowUpRightIcon aria-hidden="true" className="w-3 h-3" />
            </ButtonLink>
          </section>
          <section className="rounded-xl border border-slate-200 bg-slate-50/20 p-8 dark:border-slate-800/40 dark:bg-slate-800/60">
            <div className="flex gap-2 items-center">
              <UsersIcon aria-hidden="true" className="shrink-0 w-5 h-5" />
              <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">
                Get in touch with our sales team
              </h3>
            </div>
            <p className="mt-4">
              Contact our sales and support teams for demos, onboarding
              assistance, pricing or product questions.
            </p>
            <ButtonLink
              href="/contact/sales"
              variant="primary"
              size="default"
              title="Talk to our sales team"
              className="mt-6"
            >
              Contact sales
            </ButtonLink>
          </section>
        </div>
      </div>
    </section>
  );
}
