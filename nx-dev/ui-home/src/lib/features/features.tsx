import {
  ButtonLink,
  SectionHeading,
  Strong,
  TextLink,
} from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeatureContainer } from './feature-container';
import Image from 'next/image';
import { FeaturesWhileCoding } from './features-while-coding';
import { FeaturesWhileRunningCI } from './features-while-running-ci';
import { FeaturesWhileScalingYourOrganization } from './features-while-scaling-your-organization';

export function Features(): ReactElement {
  return (
    <section className="mt-32 scroll-mt-24 border-b border-t border-slate-200 bg-slate-50 py-24 sm:py-32 dark:border-slate-800 dark:bg-slate-900">
      <article className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading as="h2" variant="title" id="" className="scroll-mt-24">
          Build Products, Not Build Systems
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
    </section>
  );
}
