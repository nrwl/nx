'use client';
import {
  forwardRef,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ButtonLink, SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { AnimatedCurvedBeam } from '@nx/nx-dev/ui-animations';
import { CircleStackIcon, ServerIcon } from '@heroicons/react/24/outline';
import { AzureDevOpsIcon, GoogleCloudIcon, NxIcon } from '@nx/nx-dev/ui-icons';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

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
  {
    className?: string;
    children?: ReactNode;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }
>(({ className, children, onMouseEnter, onMouseLeave }, ref) => {
  return (
    <div
      ref={ref}
      className={cx(
        'z-10 flex flex-col items-center justify-between rounded-lg border border-slate-200 bg-white p-2 py-3 shadow-sm dark:border-white/10 dark:bg-slate-950',
        className
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export function CustomRemoteCacheAnimation(): ReactElement {
  const awsRef = useRef<HTMLDivElement>(null);
  const azureRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gcpRef = useRef<HTMLDivElement>(null);
  const networkDriveRef = useRef<HTMLDivElement>(null);
  const nxRef = useRef<HTMLDivElement>(null);

  const animatedBeamMap: Record<string, ReactElement> = {
    aws: (
      <AnimatedCurvedBeam
        containerRef={containerRef}
        fromRef={awsRef}
        toRef={nxRef}
        curvature={175}
        startXOffset={-20}
        endYOffset={30}
        bidirectional={true}
        duration={5}
      />
    ),
    azure: (
      <AnimatedCurvedBeam
        containerRef={containerRef}
        fromRef={azureRef}
        toRef={nxRef}
        curvature={175}
        startXOffset={20}
        endYOffset={30}
        bidirectional={true}
        reverse={true}
        duration={5}
      />
    ),
    gcp: (
      <AnimatedCurvedBeam
        containerRef={containerRef}
        fromRef={gcpRef}
        toRef={nxRef}
        bidirectional={true}
        curvature={130}
        startXOffset={20}
        endXOffset={-20}
        reverse={true}
        duration={5}
      />
    ),
    networkDrive: (
      <AnimatedCurvedBeam
        containerRef={containerRef}
        fromRef={networkDriveRef}
        toRef={nxRef}
        curvature={150}
        startXOffset={-20}
        endXOffset={20}
        bidirectional={true}
        duration={5}
      />
    ),
  };

  const links = Object.keys(animatedBeamMap);
  const duration = 6000;
  const timeout = useRef<NodeJS.Timeout>();
  const [selected, setSelected] = useState<string | null>('aws');
  const [autoplay, setAutoplay] = useState<boolean>(true);

  const play = useCallback(() => {
    timeout.current = setTimeout(next, duration);
  }, [selected]);

  const next = () => {
    if (links.length <= 1) return; // No change if there's only one or no items

    if (selected === null)
      return setSelected(links[Math.floor(Math.random() * links.length)]);

    const availableLinks = links.filter((link) => link !== selected);
    const randomIndex = Math.floor(Math.random() * availableLinks.length);
    setSelected(availableLinks[randomIndex]);
  };

  useEffect(() => {
    clearTimeout(timeout.current);
    if (autoplay) play();
  }, [selected, autoplay, play]);

  return (
    <div className="relative flex h-full w-full" ref={containerRef}>
      <div className="flex w-full flex-col items-center justify-center gap-24">
        <div className="flex w-full justify-center">
          <Card
            ref={nxRef}
            className="size-18 relative p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <NxIcon
              aria-hidden="true"
              className="size-10 text-slate-900 dark:text-white"
            />
            <CircleStackIcon
              aria-hidden="true"
              className="absolute bottom-1 right-1 size-4 text-slate-900 dark:text-white"
            />
          </Card>
        </div>
        <div className="grid w-full grid-cols-4 items-stretch gap-4">
          <Card
            ref={awsRef}
            onMouseEnter={() => {
              setAutoplay(false);
              setSelected('aws');
            }}
            onMouseLeave={() => {
              setAutoplay(true);
              setSelected(null);
            }}
            className={cx(
              'relative transition hover:bg-slate-50 dark:hover:bg-slate-800',
              { 'bg-slate-50 dark:bg-slate-800': selected === 'aws' }
            )}
          >
            <div className="text-center text-xs text-slate-900 dark:text-white">
              AWS
            </div>
            <div className="mt-1 text-center text-xl font-semibold">S3</div>

            <Link
              href="/nx-api/powerpack-s3-cache"
              title="Learn how to configure Amazon S3 caching"
              className="mt-4 text-xs"
            >
              <span className="absolute inset-0" />
              Get started
            </Link>
          </Card>
          <Card
            ref={networkDriveRef}
            onMouseEnter={() => {
              setAutoplay(false);
              setSelected('networkDrive');
            }}
            onMouseLeave={() => {
              setAutoplay(true);
              setSelected(null);
            }}
            className={cx(
              'relative transition hover:bg-slate-50 dark:hover:bg-slate-800',
              { 'bg-slate-50 dark:bg-slate-800': selected === 'networkDrive' }
            )}
          >
            <div className="text-center text-xs text-slate-900 dark:text-white">
              Network drive
            </div>
            <ServerIcon aria-hidden="true" className="mt-1 size-6" />

            <Link
              href="/nx-api/powerpack-shared-fs-cache"
              title="Learn how to configure network drive caching"
              className="mt-4 text-xs"
            >
              <span className="absolute inset-0" />
              Get started
            </Link>
          </Card>
          <Card
            ref={gcpRef}
            onMouseEnter={() => {
              setAutoplay(false);
              setSelected('gcp');
            }}
            onMouseLeave={() => {
              setAutoplay(true);
              setSelected(null);
            }}
            className={cx(
              'relative transition hover:bg-slate-50 dark:hover:bg-slate-800',
              { 'bg-slate-50 dark:bg-slate-800': selected === 'gcp' }
            )}
          >
            <div className="text-center text-xs text-slate-900 dark:text-white">
              GCP
            </div>
            <GoogleCloudIcon aria-hidden="true" className="mt-1 size-6" />

            <span
              title="Learn how to configure Google Storage caching"
              className="mt-4 text-xs"
            >
              Soon!
            </span>
          </Card>
          <Card
            ref={azureRef}
            onMouseEnter={() => {
              setAutoplay(false);
              setSelected('azure');
            }}
            onMouseLeave={() => {
              setAutoplay(true);
              setSelected(null);
            }}
            className={cx(
              'relative transition hover:bg-slate-50 dark:hover:bg-slate-800',
              { 'bg-slate-50 dark:bg-slate-800': selected === 'azure' }
            )}
          >
            <div className="text-center text-xs text-slate-900 dark:text-white">
              Azure
            </div>
            <AzureDevOpsIcon aria-hidden="true" className="mt-1 size-6" />

            <span
              title="Learn how to configure Azure Blob Storage caching"
              className="mt-4 text-xs"
            >
              Soon!
            </span>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {selected ? (
          <motion.div
            key={selected}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.2 },
            }}
          >
            {animatedBeamMap[selected]}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
