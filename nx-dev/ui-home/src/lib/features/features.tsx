import { SectionHeading, TextLink } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeaturesWhileCoding } from './features-while-coding';
import { FeaturesWhileRunningCI } from './features-while-running-ci';
import { FeaturesWhileScalingYourOrganization } from './features-while-scaling-your-organization';
import { FeaturesAiVideo } from './features-ai-video';

export function Features(): ReactElement {
  return (
    <section className="scroll-mt-24 border-b border-t border-zinc-200 bg-zinc-50 py-24 sm:py-32 dark:border-zinc-800 dark:bg-zinc-900">
      <article className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading as="h2" variant="title" id="" className="scroll-mt-24">
          Futureproof your Codebase
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Whether you’re working in a{' '}
          <TextLink
            href={
              '/docs/concepts/decisions/why-monorepos?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
            }
          >
            monorepo
          </TextLink>{' '}
          or connecting thousands of projects in a synthetic monorepo—repository
          structure determines whether AI agents will amplify your team or
          create bottlenecks down the road.
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
        <FeaturesAiVideo />
      </div>
    </section>
  );
}
