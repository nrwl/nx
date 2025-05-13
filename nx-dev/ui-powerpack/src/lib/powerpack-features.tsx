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
import {
  ButtonLink,
  SectionHeading,
  Strong,
  TextLink,
} from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { AnimatedCurvedBeam } from '@nx/nx-dev/ui-animations';
import {
  CircleStackIcon,
  ServerIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  AmazonS3Icon,
  AzureDevOpsIcon,
  GoogleCloudIcon,
  MinIOIcon,
  NxIcon,
} from '@nx/nx-dev/ui-icons';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

export function PowerpackFeatures(): ReactElement {
  return (
    <section className="relative isolate">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative flex justify-center">
          <div className="pointer-events-auto w-fit justify-between gap-x-6 bg-slate-950 px-6 py-2.5 sm:rounded-xl sm:py-3 sm:pl-4 sm:pr-3.5 dark:bg-white">
            <p className="text-sm/6 text-white dark:text-slate-950">
              <strong className="font-semibold">
                Looking for self-hosted caching?
              </strong>
              <svg
                viewBox="0 0 2 2"
                aria-hidden="true"
                className="mx-2 inline size-0.5 fill-current"
              >
                <circle r={1} cx={1} cy={1} />
              </svg>
              It is now free for everyone&nbsp;
              <Link
                href="/remote-cache"
                title="Self-hosted cache storage"
                className="text-white dark:text-slate-950"
              >
                <span className="absolute inset-0" />
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          </div>
        </div>
        <div className="mt-32 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/*<div className="flex max-w-full flex-col gap-16 bg-white/50 px-6 py-16 ring-1 ring-slate-200 sm:rounded-3xl sm:p-8 md:col-span-full lg:mx-0 lg:max-w-full lg:flex-row lg:items-center lg:py-16 xl:px-16 dark:bg-white/5 dark:ring-white/10">
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
                Use <Strong>Amazon S3</Strong>, <Strong>MinIO</Strong>,{' '}
                <Strong>GCP</Strong>, <Strong>Azure</Strong> or a{' '}
                <Strong>shared network drive</Strong> as your remote cache
                storage, offering a flexible, self-managed solution for faster
                builds. Nx Powerpack self-hosted cache storage is{' '}
                <TextLink
                  href="/nx-enterprise/powerpack/free-licenses-and-trials"
                  title="Get a Powerpack license"
                >
                  free for small teams
                </TextLink>
                .
              </p>
              <div className="mt-16">
                <ButtonLink
                  href="/nx-enterprise/powerpack/custom-caching"
                  title="Learn more about self-hosted cache storage"
                  variant="secondary"
                  size="default"
                >
                  Learn about self-hosted cache storage
                </ButtonLink>
              </div>
            </div>
            <div className="hidden w-full xl:block">
              <CustomRemoteCacheAnimation />
            </div>
          </div>*/}

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
                <Strong>at the project level</Strong>.
              </p>
              <p className="mt-6 text-pretty text-lg">
                Bridge the gap by{' '}
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
                href="/nx-enterprise/powerpack/owners"
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
                <Strong>
                  Define and run conformance rules throughout your workspace
                </Strong>
                , leverage built-in rules or{' '}
                <Strong>
                  create your own to ensure compliance with organizational
                  standards.
                </Strong>
              </p>
              <p className="mt-6 text-pretty text-lg">
                With Nx Enterprise, you can{' '}
                <Strong>
                  upload your custom rules to your Nx Cloud organization
                </Strong>{' '}
                and automatically enforce them across multiple repositories and
                workspaces, regardless of your tech stack.
              </p>
            </div>
            <div className="flex">
              <ButtonLink
                href="/nx-enterprise/powerpack/conformance"
                title="Learn how to set up conformance rules"
                variant="secondary"
                size="default"
              >
                Learn how to use conformance rules
              </ButtonLink>
            </div>
          </div>
          <div className="flex max-w-full flex-col gap-16 bg-slate-50/80 px-6 py-16 ring-1 ring-slate-200 sm:rounded-3xl sm:p-8 lg:col-span-2 lg:mx-0 lg:max-w-full lg:flex-row lg:items-center lg:py-16 xl:px-16 dark:bg-white/15 dark:ring-white/10">
            <div className="relative hidden h-full w-64 shrink-0 overflow-hidden lg:block">
              <img
                src="/images/powerpack/trust-secure-light.avif"
                alt="trust & secure illustration"
                className="absolute inset-0 block -translate-y-[85px] scale-150 transform dark:hidden"
              />
              <img
                src="/images/powerpack/trust-secure-dark.avif"
                alt="trust & secure illustration"
                className="absolute inset-0 hidden -translate-y-[85px] scale-150 transform dark:block"
              />
            </div>
            <div>
              <SectionHeading
                as="h2"
                variant="title"
                id="trustworthy-and-secure"
                className="scroll-mt-48"
              >
                Trustworthy and secure
              </SectionHeading>
              <p className="mt-6 text-pretty text-lg">
                Nx Powerpack is reliably maintained by the Nx team. Nx (the
                company) adheres to strict security and data-handling standards,
                including compliance with <Strong>SOC 2</Strong> (Type 1 and
                Type 2).
              </p>

              <div className="mt-6">
                <ButtonLink
                  href="https://security.nx.app"
                  target="_blank"
                  title="Learn how to set up conformance rules"
                  variant="secondary"
                  size="default"
                >
                  See our Trust Report
                </ButtonLink>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-16 bg-slate-50/80 px-6 py-16 ring-1 ring-slate-200 sm:rounded-3xl sm:p-8 lg:mx-0 lg:max-w-none lg:justify-between lg:py-16 xl:px-16 dark:bg-white/15 dark:ring-white/10">
            <div className="max-w-2xl">
              <SectionHeading
                as="h2"
                variant="title"
                id="faster-procurement"
                className="scroll-mt-48"
              >
                Faster procurement, simpler licensing
              </SectionHeading>
              <p className="mt-6 text-pretty text-lg">
                A simple{' '}
                <Strong>
                  licensing model that reduces red tape and speeds up
                  procurement processes
                </Strong>
                . Your teams can get started quickly without lengthy
                negotiations, ensuring a faster go-to-market.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-16 bg-slate-50/80 px-6 py-16 ring-1 ring-slate-200 sm:rounded-3xl sm:p-8 lg:mx-0 lg:max-w-none lg:justify-between lg:py-16 xl:px-16 dark:bg-white/15 dark:ring-white/10">
            <div className="max-w-2xl">
              <SectionHeading
                as="h2"
                variant="title"
                id="included-by-default"
                className="scroll-mt-48"
              >
                Ready to go for Nx Enterprise
              </SectionHeading>
              <p className="mt-6 text-pretty text-lg">
                <Strong>
                  Nx Powerpack is included at no extra cost for Nx Enterprise
                  customers
                </Strong>
                , unlocking additional capabilities without needing to manage
                more tools or onboard a new vendor.{' '}
                <TextLink href="/enterprise/trial" title="Nx Enterprise trial">
                  Request a free trial of Nx Enterprise
                </TextLink>
                .
              </p>
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
        'z-10 flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2 py-2 shadow-sm dark:border-white/10 dark:bg-slate-950',
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
  const minioRef = useRef<HTMLDivElement>(null);
  const networkDriveRef = useRef<HTMLDivElement>(null);
  const nxRef = useRef<HTMLDivElement>(null);

  const animatedBeamMap: Record<string, ReactElement> = {
    aws: (
      <AnimatedCurvedBeam
        containerRef={containerRef}
        fromRef={awsRef}
        toRef={nxRef}
        curvature={-75}
        startXOffset={-75}
        endYOffset={0}
        bidirectional={true}
        duration={5}
      />
    ),
    azure: (
      <AnimatedCurvedBeam
        containerRef={containerRef}
        fromRef={azureRef}
        toRef={nxRef}
        curvature={75}
        startXOffset={-75}
        endYOffset={0}
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
        curvature={75}
        startXOffset={-75}
        endYOffset={0}
        reverse={true}
        duration={5}
      />
    ),
    minio: (
      <AnimatedCurvedBeam
        containerRef={containerRef}
        fromRef={minioRef}
        toRef={nxRef}
        curvature={-75}
        startXOffset={-75}
        endYOffset={0}
        bidirectional={true}
        duration={5}
      />
    ),
    networkDrive: (
      <AnimatedCurvedBeam
        containerRef={containerRef}
        fromRef={networkDriveRef}
        toRef={nxRef}
        curvature={10}
        startXOffset={-75}
        endXOffset={0}
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
      <div className="grid w-full grid-cols-2 items-center justify-center gap-24">
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
        <div className="flex w-full flex-col items-stretch gap-4">
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
            <AmazonS3Icon aria-hidden="true" className="size-4" />
            <Link
              href="/nx-api/powerpack-s3-cache"
              title="Learn how to configure Amazon S3 caching"
              className="text-center text-xs text-slate-900 dark:text-white"
            >
              <span className="absolute inset-0" />
              Amazon S3
            </Link>
          </Card>
          <Card
            ref={minioRef}
            onMouseEnter={() => {
              setAutoplay(false);
              setSelected('minio');
            }}
            onMouseLeave={() => {
              setAutoplay(true);
              setSelected(null);
            }}
            className={cx(
              'relative transition hover:bg-slate-50 dark:hover:bg-slate-800',
              { 'bg-slate-50 dark:bg-slate-800': selected === 'minio' }
            )}
          >
            <MinIOIcon aria-hidden="true" className="size-4" />
            <Link
              href="/nx-api/powerpack-s3-cache"
              title="Learn how to configure Amazon S3 caching"
              className="text-center text-xs text-slate-900 dark:text-white"
            >
              <span className="absolute inset-0" />
              MinIO
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
            <ServerIcon aria-hidden="true" className="size-4" />

            <Link
              href="/nx-api/powerpack-shared-fs-cache"
              title="Learn how to configure network drive caching"
              className="text-center text-xs text-slate-900 dark:text-white"
            >
              <span className="absolute inset-0" />
              Network Drive
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
            <GoogleCloudIcon aria-hidden="true" className="size-4" />

            <Link
              href="/nx-api/powerpack-gcs-cache"
              title="Learn how to configure Google Storage caching"
              className="text-center text-xs text-slate-900 dark:text-white"
            >
              <span className="absolute inset-0" />
              GCP
            </Link>
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
            <AzureDevOpsIcon aria-hidden="true" className="size-4" />

            <Link
              href="/nx-api/powerpack-azure-cache"
              title="Learn how to configure Azure Blob Storage caching"
              className="text-center text-xs text-slate-900 dark:text-white"
            >
              <span className="absolute inset-0" />
              Azure
            </Link>
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
