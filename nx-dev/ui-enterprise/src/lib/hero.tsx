import { SectionHeading } from './temp/typography';
import { ButtonLink } from '@nx/nx-dev/ui-common';
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
          <div className="mt-10">
            <ButtonLink
              href="/contact/engineering"
              title="Talk to the engineering team"
              variant="primary"
              size="default"
            >
              Talk to engineering
            </ButtonLink>
            <p className="mt-6 italic">
              Ready to talk terms?{' '}
              <Link
                href="/contact/sales"
                title="Talk to the sales team"
                className="font-semibold underline"
                prefetch={false}
              >
                Speak directly to sales
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
