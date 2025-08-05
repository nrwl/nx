import { SectionHeading, TextLink } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeatureContainer } from './feature-container';
import Image from 'next/image';
import {
  AzureDevOpsIcon,
  BitbucketIcon,
  GitHubIcon,
  GitlabIcon,
  JenkinsIcon,
  TravisCiIcon,
} from '@nx/nx-dev-ui-icons';
import { Marquee } from '@nx/nx-dev-ui-animations';
import Link from 'next/link';

export function FeaturesWhileRunningCI(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <FeatureContainer icon="command-line">
        <SectionHeading
          as="h3"
          variant="subtitle"
          id="features-while-running-ci"
          className="scroll-mt-24 font-medium tracking-tight text-slate-950 sm:text-3xl dark:text-white"
        >
          While Running CI
        </SectionHeading>
        <div className="flex flex-col items-start gap-8 md:flex-row">
          <div className="w-full md:w-1/2">
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              <strong>
                As teams scale, more code means CI becomes the bottleneck.
              </strong>
            </SectionHeading>

            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Nx works with your CI provider to compress the entire validation
              process.{' '}
              <TextLink href="/ci/features/remote-cache?utm_medium=website&utm_campaign=homepage_links&utm_content=features">
                Remote cache
              </TextLink>{' '}
              and{' '}
              <TextLink href="/ci/features/distribute-task-execution?utm_medium=website&utm_campaign=homepage_links&utm_content=features">
                automatic task distribution
              </TextLink>{' '}
              speed up CI, while{' '}
              <TextLink href="/ci/features/self-healing-ci?utm_medium=website&utm_campaign=homepage_links&utm_content=features">
                self-healing systems
              </TextLink>{' '}
              automatically rerun flaky tests and fix code issues—instantly.
            </SectionHeading>

            <SectionHeading as="p" variant="subtitle" className="mt-6">
              The result is a short, predictable, and fully automated path to a
              green PR.
            </SectionHeading>

            <div className="mt-10 flex gap-x-6">
              <Link
                href="/nx-cloud?utm_medium=website&utm_campaign=homepage_links&utm_content=features"
                title="Add Nx Cloud to your CI workflow"
                prefetch={false}
                className="group text-xl font-semibold leading-6 text-slate-950 dark:text-white"
              >
                Learn more about Nx Cloud{' '}
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
              src="/images/home/features-while-running-ci.svg"
              width={800}
              height={800}
              alt="Illustration of a PR's timeline, with task distribution and self-healing CI"
              className="max-w-[full] lg:max-w-[full] dark:hidden"
            />
            <Image
              src="/images/home/features-while-running-ci-dark.svg"
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
