import { SectionHeading, TextLink } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeaturesWhileCoding } from './features-while-coding';
import { FeaturesWhileRunningCI } from './features-while-running-ci';
import { FeaturesWhileScalingYourOrganization } from './features-while-scaling-your-organization';
import { FeaturesCallToAction } from './features-call-to-action';

export function Features(): ReactElement {
  return (
    <section className="scroll-mt-24 border-b border-t border-slate-200 bg-slate-50 py-24 sm:py-32 dark:border-slate-800 dark:bg-slate-900">
      <article className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading as="h2" variant="title" id="" className="scroll-mt-24">
          Build Products,
          <br className="sm:hidden" /> Not Build Systems
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Whether you're a startup shipping fast or managing enterprise{' '}
          <TextLink href="/concepts/decisions/why-monorepos?utm_medium=website&utm_campaign=homepage_links&utm_content=features">
            monorepos
          </TextLink>{' '}
          with thousands of projects, Nx lets you focus on what matters and
          deliver faster.
        </SectionHeading>
      </article>
      <div className="mt-12 lg:mt-20">
        <FeaturesWhileCoding />
      </div>
      <div className="mt-12 lg:mt-12">
        <FeaturesWhileRunningCI />
      </div>
      <div className="mt-12 lg:mt-12">
        <FeaturesWhileScalingYourOrganization />
      </div>
      <div className="mt-24 lg:mt-24">
        <FeaturesCallToAction />
      </div>
    </section>
  );
}
