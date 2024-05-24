import { SectionHeading } from './temp/typography';
import { ButtonLink } from '@nx/nx-dev/ui-common';

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
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <ButtonLink
              href="/contact/sales"
              title="Contact sales"
              variant="primary"
              size="default"
            >
              Contact sales
            </ButtonLink>

            {/*<Link*/}
            {/*  className="group text-sm font-semibold leading-6 text-slate-950 dark:text-white"*/}
            {/*  href="/contact/sales"*/}
            {/*  rel="nofollow"*/}
            {/*>*/}
            {/*  Book a demo{' '}*/}
            {/*  <span*/}
            {/*    aria-hidden="true"*/}
            {/*    className="inline-block transition group-hover:translate-x-1"*/}
            {/*  >*/}
            {/*    →*/}
            {/*  </span>*/}
            {/*</Link>*/}
          </div>
        </div>
      </div>
    </section>
  );
}
