import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';

export function Hero(): JSX.Element {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mx-auto max-w-3xl text-3xl font-normal tracking-tight text-slate-700 sm:text-4xl dark:text-slate-400">
            We empower our clients to
          </p>
          <SectionHeading
            as="h1"
            variant="display"
            className="pt-4 text-4xl sm:text-5xl md:text-6xl"
          >
            Build Smarter & Ship Faster
          </SectionHeading>
          <div className="mt-16 flex items-center justify-center gap-x-6">
            <ButtonLink
              href="/contact"
              variant="contrast"
              size="default"
              title="Join us"
            >
              Reach out
            </ButtonLink>

            <a
              title="Live demo"
              href="https://staging.nx.app/orgs/62d013d4d26f260059f7765e/workspaces/62d013ea0852fe0a2df74438/overview"
              className="group font-semibold leading-6 text-slate-950 dark:text-white"
            >
              Live demo{' '}
              <span
                aria-hidden="true"
                className="inline-block transition group-hover:translate-x-1"
              >
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
