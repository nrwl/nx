'use client';
import { forwardRef, ReactElement, ReactNode, useRef } from 'react';
import { ButtonLink, SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { AnimatedAngledBeam } from '@nx/nx-dev/ui-animations';
import {
  CalendarDaysIcon,
  CircleStackIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { NxIcon } from '@nx/nx-dev/ui-icons';

export function PowerpackFeatures(): ReactElement {
  return (
    <section className="relative isolate">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="col-span-full flex max-w-full flex-col gap-16 bg-white/50 px-6 py-16 ring-1 ring-slate-200 sm:rounded-3xl sm:p-8 lg:mx-0 lg:max-w-full lg:flex-row lg:items-center lg:py-16 xl:px-16 dark:bg-white/5 dark:ring-white/10">
            <div className="xl:max-w-xl">
              <SectionHeading
                as="h2"
                variant="title"
                id="self-hosted-cache-storage"
                className="scroll-mt-48"
              >
                Self-hosted cache storage
              </SectionHeading>
              <p className="mt-6 text-pretty text-lg">
                Nx Powerpack enables you to use <Strong>Amazon S3</Strong> or a{' '}
                <Strong>shared network drive</Strong> as your remote cache
                storage, offering a flexible, self-managed solution for faster
                builds.
              </p>
              <div className="mt-16">
                <ButtonLink
                  href="/features/powerpack/custom-caching"
                  title="Learn more about self-hosted cache storage"
                  variant="secondary"
                  size="default"
                >
                  Learn about self-hosted cache storage
                </ButtonLink>
              </div>
            </div>
            <div className="hidden w-full lg:block">
              <CustomRemoteCacheAnimation />
            </div>
          </div>

          <div className="flex flex-col gap-16 bg-white/50 px-6 py-16 ring-1 ring-slate-200 sm:rounded-3xl sm:p-8 lg:mx-0 lg:max-w-none lg:justify-between lg:py-16 xl:px-16 dark:bg-white/5 dark:ring-white/10">
            <div className="max-w-2xl">
              <SectionHeading
                as="h2"
                variant="title"
                id="codeowners-for-monorepos"
                className="scroll-mt-48"
              >
                Codeowners for monorepos
              </SectionHeading>
              <p className="mt-6 text-pretty text-lg">
                Common VCS providers require folder-based ownership definitions.
                Now, define and manage ownership where it matters—
                <Strong>at the project level</Strong>
              </p>
              <p className="mt-6 text-pretty text-lg">
                Nx Powerpack codeowners bridges this gap by{' '}
                <Strong>
                  automatically tracking changes and syncing ownership data
                </Strong>{' '}
                with GitHub, GitLab, or Bitbucket-specific CODEOWNERS files.
                This ensures clear responsibilities and enables efficient
                collaboration across large-scale projects.
              </p>
            </div>
            <div className="flex">
              <ButtonLink
                href="/features/powerpack/owners"
                title="Learn more about codeowners"
                variant="secondary"
                size="default"
              >
                Learn more about codeowners
              </ButtonLink>
            </div>
          </div>
          <div className="flex flex-col gap-16 bg-white/50 px-6 py-16 ring-1 ring-slate-200 sm:rounded-3xl sm:p-8 lg:mx-0 lg:max-w-none lg:justify-between lg:py-16 xl:px-16 dark:bg-white/5 dark:ring-white/10">
            <div className="max-w-2xl">
              <SectionHeading
                as="h2"
                variant="title"
                id="workspace-conformance"
                className="scroll-mt-48"
              >
                Workspace conformance
              </SectionHeading>
              <p className="mt-6 text-pretty text-lg">
                Ensuring consistent code quality and long-term maintainability
                across large teams is critical. Nx Powerpack allows you to{' '}
                <Strong>
                  define and run conformance rules throughout your workspace
                </Strong>
                , leverage built-in rules or{' '}
                <Strong>
                  create your own to ensure compliance with organizational
                  standards.
                </Strong>
              </p>
              <p className="mt-6 text-pretty text-lg">
                With Nx Cloud Enterprise Edition, you can{' '}
                <Strong>
                  upload your custom rules to your Nx Cloud organization
                </Strong>{' '}
                and automatically enforce them across multiple repositories and
                workspaces, regardless of your tech stack.
              </p>
            </div>
            <div className="flex">
              <ButtonLink
                href="/features/powerpack/conformance"
                title="Learn how to set up conformance rules"
                variant="secondary"
                size="default"
              >
                Learn how to use conformance rules
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-x-0 top-16 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
        aria-hidden="true"
      >
        <div
          className="aspect-[1318/752] w-[82.375rem] flex-none bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-25"
          style={{
            clipPath:
              'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
          }}
        />
      </div>
    </section>
  );
}

const Card = forwardRef<
  HTMLDivElement,
  { className?: string; children?: ReactNode }
>(({ className, children }, ref) => {
  return (
    <div
      ref={ref}
      className={cx(
        'z-10 flex flex-col items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950',
        className
      )}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export function CustomRemoteCacheAnimation(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const gitHubRef = useRef<HTMLDivElement>(null);
  const gitlabRef = useRef<HTMLDivElement>(null);
  const nxRef = useRef<HTMLDivElement>(null);
  const computerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative flex h-full w-full" ref={containerRef}>
      <div className="flex w-full flex-col items-center justify-center gap-24">
        <div className="flex w-full justify-center">
          <Card ref={nxRef} className="size-18 relative">
            <NxIcon
              aria-hidden="true"
              className="size-10 text-slate-900 dark:text-white"
            />
            <CircleStackIcon
              aria-hidden="true"
              className="absolute bottom-1 right-1 size-5 text-slate-900 dark:text-white"
            />
          </Card>
        </div>
        <div className="grid w-full grid-cols-3 items-stretch gap-4">
          <Card ref={gitlabRef}>
            <div className="text-center text-sm text-slate-900 dark:text-white">
              AWS
            </div>
            <div className="mt-2 text-center text-2xl font-semibold">S3</div>

            <ButtonLink
              href="/nx-api/powerpack-s3-cache"
              title="Learn how to configure Amazon S3 caching"
              variant="secondary"
              size="small"
              className="mt-4"
            >
              Get started
            </ButtonLink>
          </Card>
          <Card ref={computerRef}>
            <div className="text-center text-sm text-slate-900 dark:text-white">
              Network drive
            </div>
            <ServerIcon aria-hidden="true" className="size-6" />

            <ButtonLink
              href="/nx-api/powerpack-shared-fs-cache"
              title="Learn how to configure network drive caching"
              variant="secondary"
              size="small"
              className="mt-4"
            >
              Get started
            </ButtonLink>
          </Card>
          <Card ref={gitHubRef}>
            <div className="text-center text-sm text-slate-900 dark:text-white">
              More soon!
            </div>
            <CalendarDaysIcon aria-hidden="true" className="size-6" />
            <div className="mt-4 size-8" />
          </Card>
        </div>
      </div>

      <AnimatedAngledBeam
        containerRef={containerRef}
        fromRef={gitlabRef}
        toRef={nxRef}
        endYOffset={0}
        bidirectional={true}
        duration={3}
      />
      <AnimatedAngledBeam
        containerRef={containerRef}
        fromRef={computerRef}
        toRef={nxRef}
        startYOffset={0}
        endYOffset={0}
        startXOffset={0}
        endXOffset={0}
        bidirectional={true}
        duration={3}
        delay={1}
      />
      <AnimatedAngledBeam
        containerRef={containerRef}
        fromRef={gitHubRef}
        toRef={nxRef}
        endYOffset={0}
        bidirectional={true}
        duration={3}
        delay={2}
      />
    </div>
  );
}
