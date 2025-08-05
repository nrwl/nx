import { SectionHeading, TextLink } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeatureContainer } from './feature-container';
import Image from 'next/image';

export function FeaturesWhileScalingYourOrganization(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <FeatureContainer icon="user-plus">
        <SectionHeading
          as="h3"
          variant="subtitle"
          id="features-while-scaling-your-organization"
          className="scroll-mt-24 font-medium tracking-tight text-slate-950 sm:text-3xl dark:text-white"
        >
          While Scaling
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          <strong>
            Tangled codebases end up crushing team velocity and product quality.
          </strong>
        </SectionHeading>
        <div className="flex flex-col items-start gap-8 md:flex-row">
          <div className="w-full md:w-1/2">
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Nx defines clear project boundaries and leverages monorepo
              concepts—shared tooling, atomic changes, and coordinated
              releases—so code stays easy to maintain.{' '}
              <TextLink href="/nx-enterprise/powerpack/owners?utm_medium=website&utm_campaign=homepage_links&utm_content=features">
                Ownership
              </TextLink>{' '}
              is defined at the project level, while{' '}
              <TextLink href="/nx-enterprise/powerpack/conformance?utm_medium=website&utm_campaign=homepage_links&utm_content=features">
                conformance rules
              </TextLink>{' '}
              enforce organizational standards automatically across your{' '}
              <strong>entire codebase</strong>.
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              <TextLink href="/plugin-registry?utm_medium=website&utm_campaign=homepage_links&utm_content=features">
                Nx plugins
              </TextLink>{' '}
              and{' '}
              <TextLink href="/features/generate-code?utm_medium=website&utm_campaign=homepage_links&utm_content=features">
                code generation
              </TextLink>{' '}
              standardize best practices and eliminate duplication, while
              automated updates keep everything current without the overhead of
              managing separate repositories.
            </SectionHeading>
          </div>
          <div className="w-full md:w-1/2">
            {/* gradient is too complex for svg and doesn't look good in avif */}
            <Image
              src="/images/home/features-while-scaling-org.webp"
              width={800}
              height={800}
              alt="Illustration of a cluster of plugins, rules, and code generation tools, with branches sprouting from them"
              className="max-w-[full] lg:max-w-[full] dark:hidden"
            />
            <Image
              src="/images/home/features-while-scaling-org-dark.webp"
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
