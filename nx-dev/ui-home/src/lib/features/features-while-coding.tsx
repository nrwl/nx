import { SectionHeading, Strong, TextLink } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeatureContainer } from './feature-container';
import Image from 'next/image';
import Link from 'next/link';

export function FeaturesWhileCoding(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <FeatureContainer icon="code">
        <div className="flex flex-col items-start gap-8 md:flex-row">
          <div className="w-full md:w-1/2">
            <SectionHeading
              as="h3"
              variant="subtitle"
              id="features-while-coding"
              className="scroll-mt-24 font-medium tracking-tight text-slate-950 sm:text-3xl dark:text-white"
            >
              While Coding
            </SectionHeading>
            <div className="mt-6">
              <SectionHeading as="p" variant="subtitle" className="mt-6">
                <strong>
                  The code isn't the problem—it's everything else that pulls you
                  away from it.
                </strong>
              </SectionHeading>
              <SectionHeading as="p" variant="subtitle" className="mt-6">
                Drop Nx into any codebase and it automatically understands your
                project structure,{' '}
                <TextLink href="/features/run-tasks">
                  executing tasks efficiently
                </TextLink>{' '}
                with intelligent{' '}
                <TextLink href="/features/cache-task-results">caching</TextLink>{' '}
                and a clean{' '}
                <TextLink href="/recipes/running-tasks/terminal-ui">
                  terminal interface
                </TextLink>{' '}
                that keeps you focused on what matters.
              </SectionHeading>
              <SectionHeading as="p" variant="subtitle" className="mt-6">
                <TextLink href="/concepts/nx-plugins">Nx plugins</TextLink>{' '}
                eliminate the complexity of juggling multiple tools and
                configurations, handling setup and coordination across different
                technologies so you don't have to.
              </SectionHeading>
              <SectionHeading as="p" variant="subtitle" className="mt-6">
                Your AI coding assistant gets{' '}
                <TextLink href="/features/enhance-AI">
                  complete workspace context through Nx
                </TextLink>
                , understanding project relationships and dependencies to
                provide more accurate, codebase-specific guidance.
              </SectionHeading>
            </div>

            <div className="mt-10 flex gap-x-6">
              <Link
                href="/getting-started/intro"
                title="Find out about Nx"
                prefetch={false}
                className="group text-xl font-semibold leading-6 text-slate-950 dark:text-white"
              >
                Learn more about Nx{' '}
                <span
                  aria-hidden="true"
                  className="inline-block transition group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <Image
              src="/images/home/features-while-coding.svg"
              width={800}
              height={800}
              alt=""
              className="max-w-[full] lg:max-w-[full] dark:hidden"
            />
            <Image
              src="/images/home/features-while-coding-dark.svg"
              width={800}
              height={800}
              alt=""
              className="hidden max-w-[full] lg:max-w-[full] dark:block"
            />
          </div>
        </div>
      </FeatureContainer>
    </article>
  );
}
