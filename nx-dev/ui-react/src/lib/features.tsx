import { SectionHeading } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import React, { ReactElement } from 'react';

export function Features(): ReactElement {
  return (
    <>
      <SectionHeading as="h2" variant="title">
        Features
      </SectionHeading>

      <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
        Nx allows you to take existing React projects and add powerful
        capabilities to your workflow.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Task Caching"
          description="Cache task results locally and remotely, avoiding redundant builds and speeding up your development workflow."
          href="/features/cache-task-results"
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <polyline
                points="12 6 12 12 16 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <FeatureCard
          title="Distributed Task Execution"
          description="Run your project tasks across multiple machines, dramatically reducing build times for large repositories."
          href="/ci/features/distribute-task-execution"
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="2"
                y="7"
                width="20"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M6 7V4.5C6 3.67157 6.67157 3 7.5 3H16.5C17.3284 3 18 3.67157 18 4.5V7"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 14L12 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M9 12L15 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          }
        />
        <FeatureCard
          title="Affected Targets"
          description="Run tasks only on projects affected by your changes, saving time and computing resources."
          href="/ci/features/affected"
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 4L12 14L9 11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <FeatureCard
          title="Project Graph"
          description="Nx automatically infers your project graph from project's configuration, providing visualization and dependency analysis."
          href="/features/explore-graph"
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="5"
                cy="5"
                r="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle
                cx="19"
                cy="5"
                r="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle
                cx="5"
                cy="19"
                r="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle
                cx="19"
                cy="19"
                r="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path d="M7 5H17" stroke="currentColor" strokeWidth="2" />
              <path d="M5 7V17" stroke="currentColor" strokeWidth="2" />
              <path d="M7 19H17" stroke="currentColor" strokeWidth="2" />
              <path d="M19 7V17" stroke="currentColor" strokeWidth="2" />
            </svg>
          }
        />
        <FeatureCard
          title="Split E2E Tests"
          description="Automatically split your E2E tests for faster parallel execution in CI environments with Atomizer."
          href="/ci/features/split-e2e-tasks"
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14 3V7C14 7.55228 14.4477 8 15 8H19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H14L19 8V19C19 20.1046 18.1046 21 17 21Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 12L8 14L10 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 12L16 14L14 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <FeatureCard
          title="Zero Configuration"
          j
          description="Add Nx to your existing monorepo in minutes."
          href="/recipes/adopting-nx/adding-to-monorepo"
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      </div>
    </>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: JSX.Element;
  href?: string;
}

function FeatureCard({
  title,
  description,
  icon,
  href = '#',
}: FeatureCardProps): ReactElement {
  return (
    <a href={href} className="block h-full transform-gpu">
      <div
        className={cx(
          'group relative h-full w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-6',
          'dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:shadow-blue-900/20',
          'before:absolute before:inset-0 before:z-0 before:bg-gradient-to-br before:from-blue-50 before:to-transparent before:opacity-0 before:transition-opacity',
          'transition-all duration-300 ease-out',
          'hover:-translate-y-2 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/50',
          'hover:before:opacity-100 dark:before:from-blue-950'
        )}
      >
        <div className="relative z-10">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-110 dark:bg-slate-800 dark:text-blue-400 dark:group-hover:bg-blue-900">
            {icon}
          </div>
          <h3 className="mb-2 text-lg font-medium">{title}</h3>
          <p className="text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </a>
  );
}
