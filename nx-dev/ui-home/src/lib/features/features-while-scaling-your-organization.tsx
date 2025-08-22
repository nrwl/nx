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
          className="scroll-mt-24 text-2xl font-medium tracking-tight text-slate-950 sm:text-3xl dark:text-white"
        >
          While Scaling
        </SectionHeading>
        <div className="flex flex-col items-start gap-8 md:flex-row">
          <div className="prose-lg mt-6 w-full md:w-1/2">
            <p>
              <strong>
                Tangled codebases end up crushing team velocity and product
                quality.
              </strong>
            </p>
            <p>
              Nx defines{' '}
              <TextLink
                href="/features/enforce-module-boundaries"
                className="decoration-2"
              >
                clear project boundaries
              </TextLink>{' '}
              and leverages monorepo concepts—shared tooling, atomic changes,
              and coordinated releases—so code stays easy to maintain.{' '}
              <TextLink
                href="/nx-enterprise/powerpack/owners"
                className="decoration-2"
              >
                Ownership
              </TextLink>{' '}
              is defined at the project level, while{' '}
              <TextLink
                href="/nx-enterprise/powerpack/conformance"
                className="decoration-2"
              >
                conformance rules
              </TextLink>{' '}
              enforce organizational standards automatically across your{' '}
              <strong>entire codebase</strong>.
            </p>
            <p>
              <TextLink href="/plugin-registry" className="decoration-2">
                Nx plugins
              </TextLink>{' '}
              and{' '}
              <TextLink href="/features/generate-code" className="decoration-2">
                code generation
              </TextLink>{' '}
              standardize best practices and eliminate duplication, while{' '}
              <TextLink
                href="/features/automate-updating-dependencies"
                className="decoration-2"
              >
                automated updates
              </TextLink>{' '}
              keep everything current without the overhead of managing separate
              repositories.
            </p>
          </div>
          <div className="w-full md:w-1/2">
            <Image
              src="/images/home/features-while-scaling-org.svg"
              width={800}
              height={800}
              alt="Illustration of a cluster of plugins, rules, and code generation tools, with branches sprouting from them"
              className="max-w-[full] lg:max-w-[full] dark:hidden"
            />
            <Image
              src="/images/home/features-while-scaling-org-dark.svg"
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
