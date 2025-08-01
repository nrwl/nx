import {
  ButtonLink,
  SectionHeading,
  Strong,
  TextLink,
} from '@nx/nx-dev-ui-common';
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
              <TextLink href="/nx-enterprise/powerpack/owners">
                Ownership
              </TextLink>{' '}
              is defined at the project level, while{' '}
              <TextLink href="/nx-enterprise/powerpack/conformance">
                conformance rules
              </TextLink>{' '}
              enforce organizational standards automatically across your{' '}
              <strong>entire codebase</strong>.
            </SectionHeading>
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              <TextLink href="/plugin-registry">Nx plugins</TextLink> and{' '}
              <TextLink href="/features/generate-code">
                code generation
              </TextLink>{' '}
              standardize best practices and eliminate duplication, while
              automated updates keep everything current without the overhead of
              managing separate repositories.
            </SectionHeading>
            {/* <div className="mt-10 flex gap-x-6">
              <ButtonLink
                href="https://cloud.nx.app/get-started?utm_source=nx-dev&utm_medium=homepage_links&utm_campaign=try-nx-cloud"
                title="Get started"
                variant="primary"
                size="large"
              >
                Try Nx for yourself
              </ButtonLink>
            </div> */}
          </div>
          <div className="w-full md:w-1/2">
            <Image
              src="/images/home/features-while-scaling-org.svg"
              width={800}
              height={800}
              alt=""
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
