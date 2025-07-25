import {
  ButtonLink,
  SectionHeading,
  Strong,
  TextLink,
} from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeatureContainer } from './feature-container';
import Image from 'next/image';

export function FeaturesWhileRunningCI(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <FeatureContainer icon="command-line">
        <SectionHeading as="h2" variant="title" id="" className="scroll-mt-24">
          While Running CI
        </SectionHeading>
        <div className="flex max-w-5xl items-start gap-8">
          <div className="w-1/2">
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              <strong>
                The Problem Isn't Just Writing Code — It's Merging It.
              </strong>{' '}
              Your scaling investments won't pay off if your CI becomes your
              bottleneck.
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Nx compresses the entire validation process. Its remote cache and
              automatic task distribution speed up CI, while its self-healing
              system automatically reruns flaky tests and fixes code issues. The
              result is a short, predictable, and fully automated path to a
              green PR.
            </SectionHeading>

            <SectionHeading as="p" variant="subtitle" className="mt-6">
              (It works with all CI providers)
            </SectionHeading>

            <ButtonLink
              href="https://cloud.nx.app/get-started"
              title="Get started"
              variant="primary"
              size="default"
            >
              Get started
            </ButtonLink>
          </div>
          <div className="w-1/2">
            <Image
              src="/images/home/features-ci.png"
              width={800}
              height={800}
              alt=""
              className="max-w-[full] lg:max-w-[full]"
            />
          </div>
        </div>
      </FeatureContainer>
    </article>
  );
}
