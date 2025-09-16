import { SectionHeading, TextLink } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeatureContainer } from './feature-container';
import Image from 'next/image';
import Link from 'next/link';

export function FeaturesWhileCoding(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <FeatureContainer icon="code">
        <SectionHeading
          as="h3"
          variant="subtitle"
          id="features-while-coding"
          className="scroll-mt-24 text-2xl font-medium tracking-tight text-slate-950 sm:text-3xl dark:text-white"
        >
          While Coding
        </SectionHeading>
        <div className="flex flex-col items-start gap-8 md:flex-row">
          <div className="prose-lg mt-6 w-full md:w-1/2">
            <p>
              <strong>
                The code isn't the problem—it's everything else that pulls you
                away from it.
              </strong>
            </p>
            <p>
              Drop Nx into any codebase and it automatically understands your
              project structure,{' '}
              <TextLink
                href={
                  process.env.NEXT_PUBLIC_ASTRO_URL
                    ? '/docs/features/run-tasks?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                    : '/features/run-tasks?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                }
                className="decoration-2"
              >
                executing tasks efficiently
              </TextLink>{' '}
              with intelligent{' '}
              <TextLink
                href={
                  process.env.NEXT_PUBLIC_ASTRO_URL
                    ? '/docs/features/cache-task-results?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                    : '/features/cache-task-results?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                }
                className="decoration-2"
              >
                caching
              </TextLink>{' '}
              and a clean{' '}
              <TextLink
                href={
                  process.env.NEXT_PUBLIC_ASTRO_URL
                    ? '/docs/guides/tasks--caching/terminal-ui?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                    : '/recipes/running-tasks/terminal-ui?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                }
                className="decoration-2"
              >
                terminal interface
              </TextLink>{' '}
              that keeps you focused on what matters.
            </p>
            <p>
              <TextLink
                href={
                  process.env.NEXT_PUBLIC_ASTRO_URL
                    ? '/docs/concepts/nx-plugins?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                    : '/concepts/nx-plugins?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                }
                className="decoration-2"
              >
                Nx plugins
              </TextLink>{' '}
              eliminate the complexity of juggling multiple tools and
              configurations, handling setup and coordination across different
              technologies so you don't have to.
            </p>
            <p>
              Your{' '}
              <TextLink
                href={
                  process.env.NEXT_PUBLIC_ASTRO_URL
                    ? '/docs/features/enhance-ai?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                    : '/features/enhance-AI?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                }
                className="decoration-2"
              >
                AI coding assistant
              </TextLink>{' '}
              gets complete workspace context through Nx, understanding project
              relationships and dependencies to provide more accurate,
              codebase-specific guidance.
            </p>

            <div className="mt-10 flex gap-x-6">
              <Link
                href={
                  process.env.NEXT_PUBLIC_ASTRO_URL
                    ? '/docs/getting-started/intro?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                    : '/getting-started/intro?utm_medium=website&utm_campaign=homepage_links&utm_content=features'
                }
                title="Find out about Nx"
                prefetch={false}
                className="group font-semibold leading-6 text-slate-950 dark:text-white"
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
              alt="Illustration of an editor window, with a project graph and AI"
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
