import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import Link from 'next/link';

export function Hero(): JSX.Element {
  return (
    <section>
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading id="fast-ci-for-monorepo" as="h1" variant="display">
            Nx Enterprise
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-3xl "
          >
            Accelerate your organization's journey to tighter collaboration,
            better developer experience, and speed…lots of speed.
          </SectionHeading>
          <div className="mt-10 items-center justify-center gap-x-6">
            <ButtonLink
              href="/contact/sales"
              title="Request a free trial"
              variant="primary"
              size="default"
            >
              Request a free trial
            </ButtonLink>
            <p className="mt-6 italic">
              Got questions?{' '}
              <Link
                href="/contact/engineering"
                title="Talk to the sales team"
                className="font-semibold underline"
                prefetch={false}
              >
                Talk to an engineer.
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
