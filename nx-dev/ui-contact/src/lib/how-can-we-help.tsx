import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import {
  ArrowUpRightIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
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
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-slate-50/20 p-8 dark:border-slate-800/40 dark:bg-slate-800/60">
            <div className="flex items-center gap-2">
              <ChevronRightIcon
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
              />
              <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">
                Sales
              </h3>
            </div>
            <p className="mt-4">
              Contact our sales team to discuss pricing, terms, certifications,
              and your unique constraints.
            </p>
            <ButtonLink
              href="/contact/sales"
              variant="primary"
              size="default"
              title="Talk to our sales team"
              className="mt-6"
            >
              Reach out to sales
            </ButtonLink>
          </section>
          <section className="rounded-xl border border-slate-200 bg-slate-50/20 p-8 dark:border-slate-800/40 dark:bg-slate-800/60">
            <div className="flex items-center gap-2">
              <ChevronRightIcon
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
              />
              <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">
                Engineers
              </h3>
            </div>
            <p className="mt-4">
              Contact our developer productivity engineers for demos, onboarding
              assistance, and technical product questions.
            </p>
            <ButtonLink
              href="/contact/engineering"
              variant="primary"
              size="default"
              title="Talk to our engineering team"
              className="mt-6"
            >
              Reach out to engineers
            </ButtonLink>
          </section>
          <section className="rounded-xl border border-slate-200 bg-slate-50/20 p-8 md:col-span-2 dark:border-slate-800/40 dark:bg-slate-800/60">
            <div className="flex items-center gap-2">
              <ChatBubbleLeftRightIcon
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
              />
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">
                Question about Nx
              </h3>
            </div>
            <p className="mt-4">
              Ask a question, receive guidance, share ideas or simply leave
              feedback about our products on the Discord channel. A vibrant
              community of Nx users will be able to help you.
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
              <ArrowUpRightIcon aria-hidden="true" className="h-3 w-3" />
            </ButtonLink>
          </section>
        </div>
      </div>
    </section>
  );
}
