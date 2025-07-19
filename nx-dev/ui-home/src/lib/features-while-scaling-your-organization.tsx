import {
  ButtonLink,
  SectionHeading,
  Strong,
  TextLink,
} from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeatureContainer } from './feature-container';

export function FeaturesWhileScalingYourOrganization(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <FeatureContainer icon="user-plus">
        <SectionHeading as="h2" variant="title" id="" className="scroll-mt-24">
          While Scaling Your Organization
        </SectionHeading>
        <div className="flex max-w-5xl items-start gap-8">
          <div className="w-1/2">
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Tangled codebases without well-defined ownership crush the
              velocity of teams and the quality of products. Nx is the solution.
              By defining project boundaries, developers ensure code stays
              modular and easy to maintain. By using Nx plugins and code
              generation , developers standardize on best practices and reduce
              duplication. Plus, they keep everything up-to-date by using Nx's
              automated updating mechanism.
            </SectionHeading>
            <div className="mt-10 flex gap-x-6">
              <ButtonLink
                href="https://cloud.nx.app/get-started?utm_source=nx-dev&utm_medium=homepage_links&utm_campaign=try-nx-cloud"
                title="Get started"
                variant="primary"
                size="large"
              >
                Try Nx for yourself
              </ButtonLink>
            </div>
          </div>
          <div
            className="relative mt-8 flex h-[20rem] w-1/2 items-center justify-center rounded bg-slate-100"
            title="placeholder for graphic"
          >
            <span className="text-2xl font-bold text-slate-300">Graphic</span>
          </div>
        </div>
      </FeatureContainer>
    </article>
  );
}
