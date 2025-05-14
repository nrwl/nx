import { ButtonLink, SectionHeading, TextLink } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import React, { ReactElement } from 'react';

export function WebinarCallout(): ReactElement {
  return (
    <>
      <SectionHeading as="h2" variant="title">
        Resources
      </SectionHeading>
      <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
        Learn more about using Nx with Java projects with these resources.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
        <ResourceCard
          title="Gradle Tutorial"
          description="Follow this step-by-step tutorial to add Nx to an existing Gradle project."
          linkText="View tutorial"
          href="/tutorials/gradle"
        />

        <ResourceCard
          title="Gradle Plugin Documentation"
          description="Learn all the details about the Nx Gradle plugin configuration and usage."
          linkText="View docs"
          href="/packages/gradle/gradle-plugin"
        />

        <ResourceCard
          title="CI with Nx"
          description="Learn how to configure Continuous Integration with Nx for faster builds."
          linkText="View CI docs"
          href="/ci/intro/ci-with-nx"
        />
      </div>
    </>
  );
}

interface ResourceCardProps {
  title: string;
  description: string;
  linkText: string;
  href: string;
}

function ResourceCard({
  title,
  description,
  linkText,
  href,
}: ResourceCardProps): ReactElement {
  return (
    <div
      className={cx(
        'flex h-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900'
      )}
    >
      <div>
        <h3 className="mb-2 text-lg font-medium">{title}</h3>
        <p className="text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="mt-6">
        <ButtonLink href={href} size="small" variant="primary" title={linkText}>
          {linkText}
        </ButtonLink>
      </div>
    </div>
  );
}
