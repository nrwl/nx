import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';

import { EnterprisePlan } from './plans/enterprise-plan';
import { HobbyPlan } from './plans/hobby-plan';
import { ProPlan } from './plans/pro-plan';

export function StandardPlans() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-4xl text-center">
        <SectionHeading as="h2" variant="display">
          Start with everything,
          <br /> scale when you need
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Level up your CI with Nx Cloud
        </SectionHeading>
      </header>

      <div className="relative mt-32 w-full" />
      {/* Plans */}
      <section id="plans">
        {/* <header>
          <div className="mx-auto max-w-4xl text-center">
            <SectionHeading as="h2" variant="title">
              Start Free, Scale Smart
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Kick off with complimentary credits and explore everything Nx
              Cloud offers. Add your card details when you're ready for more.
            </SectionHeading>
          </div>
        </header> */}
        <div className="isolate mx-auto mt-10 grid max-w-lg grid-cols-1 items-stretch gap-x-4 gap-y-16 sm:mt-20 md:max-w-3xl md:grid-cols-3 xl:max-w-full xl:grid-cols-3">
          <HobbyPlan url="https://cloud.nx.app" />
          <ProPlan url="https://cloud.nx.app" />
          <EnterprisePlan url="/enterprise" />
        </div>
        <p className="mt-2 text-center text-sm opacity-80 xl:text-left">
          Credits are the Nx Cloud currency allowing for usage based pricing.
          Prices do not include applicable taxes.
        </p>
      </section>
      <div className="mx-auto my-8 text-center">
        <ButtonLink
          href="#plan-details"
          title="Compare all plans options and benefits"
          variant="secondary"
          size="default"
        >
          Compare all plans options and benefits
        </ButtonLink>
      </div>
    </section>
  );
}
