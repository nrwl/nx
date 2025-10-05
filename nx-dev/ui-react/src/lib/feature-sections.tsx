import { ReactElement } from 'react';
import { ButtonLink, SectionHeading } from '@nx/nx-dev-ui-common';

export function FeatureSections(): ReactElement {
  return (
    <section className="feature-sections py-16 sm:py-24">
      <div className="mx-auto px-6 lg:max-w-7xl">
        <SectionHeading id="nx-gradle-features" as="h2" variant="title">
          Supercharge your Java Projects{' '}
          <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            with Nx
          </span>
        </SectionHeading>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:mt-16 md:grid-cols-2 lg:grid-cols-3 ">
          {/* Affected Section */}
          <FeatureSection
            title="Affected"
            description="Run tasks only on projects affected by your changes, saving time and resources. Nx understands your project's dependency graph and automatically determines which projects need to be rebuilt."
            imageSrc="/images/enterprise/nx-affected.avif"
            alt="Nx Affected: Run tasks only on affected projects"
            tag="Affected"
            href={
              process.env.NEXT_PUBLIC_ASTRO_URL
                ? '/docs/ci/features/affected'
                : '/ci/features/affected'
            }
          />

          {/* Remote Caching Section */}
          <FeatureSection
            title="Never build the same code twice"
            description="Nx Replay (Remote Caching) ensures tasks are never rebuilt unnecessarily. Share cached results across your team and CI pipelines to dramatically reduce build times and resource usage."
            imageSrc="/images/enterprise/nx-replay.avif"
            alt="Nx Replay: Remote caching"
            tag="Nx Replay"
            href={
              process.env.NEXT_PUBLIC_ASTRO_URL
                ? '/docs/features/cache-task-results'
                : '/features/cache-task-results'
            }
          />

          {/* Distribution Section */}
          <FeatureSection
            title="Distribute tasks across machines"
            description="Nx Agents intelligently distribute your Gradle tasks across multiple machines, significantly reducing build times. Dynamically allocate agents based on PR size to balance speed and cost."
            imageSrc="/images/enterprise/nx-agents.avif"
            alt="Nx Agents: Task distribution"
            tag="Nx Agents"
            href={
              process.env.NEXT_PUBLIC_ASTRO_URL
                ? '/docs/ci/features/distribute-task-execution'
                : '/ci/features/distribute-task-execution'
            }
          />

          {/* Atomizer Section */}
          <FeatureSection
            title="Break tests down, speed execution up"
            description="Atomizer automatically splits large Gradle test tasks into smaller, atomized units, enabling lightning fast parallel testing. No code changes required - just configure and run."
            imageSrc="/images/enterprise/nx-atomizer.avif"
            alt="Nx Atomizer: Split large test tasks"
            tag="Atomizer"
            href={
              process.env.NEXT_PUBLIC_ASTRO_URL
                ? '/docs/ci/features/split-e2e-tasks'
                : '/ci/features/split-e2e-tasks'
            }
          />

          {/* Flaky Test Retries Section */}
          <FeatureSection
            title="Automatically handle flaky tests"
            description="Nx detects and automatically retries flaky tests, enhancing the reliability of your CI processes and minimizing time spent debugging intermittent failures."
            imageSrc="/images/enterprise/nx-flaky-tasks-detection.avif"
            alt="Nx flaky task detection & rerun"
            tag="Flaky test retries"
            href="/nx-api/gradle/documents/overview"
          />
        </div>
      </div>
    </section>
  );
}

interface FeatureSectionProps {
  title: string;
  description: string;
  imageSrc: string;
  alt: string;
  tag: string;
  href: string;
  reversed?: boolean;
}

function FeatureSection({
  title,
  description,
  imageSrc,
  alt,
  tag,
  href,
}: FeatureSectionProps): ReactElement {
  return (
    <div
      className={`feature-section flex flex-col overflow-hidden rounded-2xl bg-white shadow ring-1 ring-black/5  dark:bg-slate-950 dark:ring-white/10 `}
    >
      <div className="h-0 w-full md:h-72">
        <img
          alt={alt}
          src={imageSrc}
          className="h-full w-full object-cover object-center"
        />
      </div>
      <div className="relative flex flex-1 flex-col justify-center p-8 lg:p-10">
        <div>
          <span className="mb-3 inline-flex items-center rounded-full bg-slate-400/10 px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20 dark:text-slate-300">
            {tag}
          </span>
          <h3 className="mt-2 text-xl font-medium tracking-tight text-slate-950 lg:text-2xl dark:text-white">
            {title}
          </h3>
          <p className="mt-4 text-base/relaxed text-slate-600 dark:text-slate-300">
            {description}
          </p>
          <div className="mt-6">
            <ButtonLink
              href={href}
              title={`Learn more about ${title}`}
              variant="secondary"
              size="default"
            >
              Learn more
              <svg
                className="ml-2 h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                  clipRule="evenodd"
                />
              </svg>
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
