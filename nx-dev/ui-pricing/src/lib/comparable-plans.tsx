import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import { PlanTable } from './plans/plan-table';

export function ComparablePlans() {
  return (
    <section
      id="plan-details"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
    >
      <header>
        <div className="mx-auto max-w-4xl text-center">
          <SectionHeading as="h2" variant="title">
            Plans in detail
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            Compare plan options and benefits.
          </SectionHeading>
        </div>
      </header>
      <div className="isolate mx-auto mt-10 max-w-full sm:mt-20">
        <PlanTable />
        <p className="mt-2 text-sm opacity-80">
          Credits are the Nx Cloud currency allowing for usage-based pricing.
          Prices do not include applicable taxes.
        </p>
        <div className="mt-4 flex justify-center">
          <ButtonLink
            href="https://cloud.nx.app"
            aria-describedby="hobby-plan"
            title="Hobby"
            size="default"
            className="my-2"
          >
            Get started now for free
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
