import { AnimateValue, Marquee } from '@nx/nx-dev-ui-animations';
import {
  ButtonLink,
  SectionHeading,
  Strong,
  TextLink,
  VideoPlayer,
  VideoPlayerProvider,
  VideoPlayerThumbnail,
  VideoPlayerOverlay,
  VideoPlayerButton,
  VideoPlayerModal,
} from '@nx/nx-dev-ui-common';
import {
  AzureDevOpsIcon,
  BitbucketIcon,
  GitHubIcon,
  GitlabIcon,
  JenkinsIcon,
  TravisCiIcon,
} from '@nx/nx-dev-ui-icons';
import { cx } from '@nx/nx-dev-ui-primitives';
import Link from 'next/link';
import { ReactNode } from 'react';

export function CiForMonorepos(): JSX.Element {
  return (
    <section className="bg-slate-50 py-32 shadow-inner sm:py-40 dark:bg-slate-900">
      <article className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-5xl">
          <SectionHeading
            as="h2"
            variant="title"
            id="ci-for-monorepos"
            className="scroll-mt-24"
          >
            Finally! CI that works for monorepos.
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            Current CI systems are <Strong>slow</Strong>,{' '}
            <Strong>hard to maintain, and unreliable</Strong>. With Nx Cloud, we
            introduce an{' '}
            <TextLink
              href="/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_ci_for_monorepos"
              title="Task-based CI by Nx"
            >
              innovative task-based approach
            </TextLink>{' '}
            to making CI for monorepos not just <Strong>fast</Strong>, but also{' '}
            <Strong>cost-efficient</Strong>. It plugs right into your existing
            CI setup, enabling features such as{' '}
            <TextLink
              href="/ci/features/remote-cache?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_ci_for_monorepos"
              title="Remote caching with Nx Replay"
            >
              remote caching
            </TextLink>
            ,{' '}
            <TextLink
              href="/ci/features/distribute-task-execution?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_ci_for_monorepos"
              title="Distribute task execution with Nx Agents "
            >
              dynamically allocating machines to distribute tasks
            </TextLink>
            , providing{' '}
            <TextLink
              href="/ci/features/split-e2e-tasks?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_ci_for_monorepos"
              title="E2E test splitting with Atomizer"
            >
              fine-grained e2e test splitting
            </TextLink>{' '}
            and{' '}
            <TextLink
              href="/ci/features/flaky-tasks?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_ci_for_monorepos"
              title="Flakiness detection with Nx"
            >
              automated flakiness detection
            </TextLink>
            . <Strong>All with a single line of code!</Strong>
          </SectionHeading>
        </div>
        <div className="mt-24 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ApplicationCard />
          <div className="grid grid-cols-2 gap-4 lg:col-span-8 lg:grid-cols-2">
            <ProjectsCreatedEveryMonth />
            <HalveYouBill />
            <IntegratesToYouCurrentCiProvider />
          </div>
          <div className="lg:col-span-12">
            <AiSection />
          </div>
        </div>
      </article>
    </section>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div
      className={cx(
        'relative h-full w-full overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 dark:border-slate-800/60 dark:bg-slate-950',
        className
      )}
    >
      {children}
    </div>
  );
}

export function PulseLine({
  className = '',
}: {
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cx(
        'absolute left-0 top-1/2 h-48 w-[1px] -translate-y-1/2 animate-pulse bg-gradient-to-b from-blue-500/0 via-blue-400 to-blue-500/0',
        className
      )}
    />
  );
}

export function CornerBlur({
  className = '',
}: {
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cx(
        'absolute bottom-0 left-0 z-0 size-72 -translate-x-1/2 translate-y-1/2 rounded-full bg-slate-50 blur-2xl dark:bg-slate-900',
        className
      )}
    />
  );
}

export function ApplicationCard(): JSX.Element {
  return (
    <div className="col-span-1 h-[600px] lg:col-span-4 lg:h-[600px]">
      <Card>
        <PulseLine />
        <CornerBlur />
        <p className="text-2xl text-slate-900 dark:text-slate-100">
          Powerful and elegant UI
        </p>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          An application built for monorepo CI, so you can quickly find what
          failed, debug and move on.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="https://staging.nx.app/orgs/62d013d4d26f260059f7765e/workspaces/62d013ea0852fe0a2df74438/overview??utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_ci_for_monorepos_live_demo"
            target="_blank"
            rel="noopener"
            title="See Nx Cloud live demo"
            className="group font-semibold leading-6 text-slate-950 dark:text-white"
          >
            View a live demo{' '}
            <span
              aria-hidden="true"
              className="inline-block transition group-hover:translate-x-1"
            >
              →
            </span>
          </a>
        </div>
        <div className="absolute bottom-0 left-4 h-[345px] w-full overflow-hidden rounded-xl border border-slate-200 dark:bg-slate-800">
          <VideoPlayerProvider videoUrl="https://www.youtube.com/embed/4VI-q943J3o?si=3tR-EkCKLfLvHYzL">
            <VideoPlayer>
              <VideoPlayerThumbnail
                src="/images/home/nx-app-dashboard.avif"
                alt="App screenshot: overview"
                width={534}
                height={370}
              />
              <VideoPlayerOverlay>
                <VideoPlayerButton
                  variant="blue-white-spin"
                  text={{
                    primary: 'See how Nx Cloud works',
                    secondary: 'In under 9 minutes',
                  }}
                />
              </VideoPlayerOverlay>
            </VideoPlayer>
            <VideoPlayerModal />
          </VideoPlayerProvider>
        </div>
      </Card>
    </div>
  );
}

//
export function ProjectsCreatedEveryMonth(): JSX.Element {
  return (
    <div className="relative col-span-2 h-[360px] md:col-span-1">
      <Card className="relative">
        <div className="flex flex-col justify-between text-center drop-shadow">
          <div>
            <span className="text-9xl font-bold text-slate-950 dark:text-white">
              <AnimateValue num={20} suffix="k" once />
            </span>
            <br />
            <span className="text-4xl font-semibold text-slate-950 dark:text-white">
              new projects
            </span>
          </div>
          <span className="text-2xl font-semibold text-slate-600 dark:text-slate-400">
            every month
          </span>
        </div>
        <div className="mt-8 text-center">
          <ButtonLink
            href="https://cloud.nx.app/get-started?utm_source=nx-dev&utm_medium=homepage_links&utm_campaign=try-nx-cloud"
            title="Get started with Nx Cloud"
            variant="primary"
            size="large"
            target="_blank"
            rel="nofollow"
          >
            Connect to Nx Cloud now!
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
//

//
export function HalveYouBill(): JSX.Element {
  return (
    <div className="col-span-2 h-[415px] sm:h-[360px] md:col-span-1">
      <Card>
        <p className="text-2xl text-slate-900 dark:text-slate-100">
          Halve your CI bill
        </p>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Nx Cloud not only makes your runs{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            30% to 70% faster
          </span>
          , but also significantly cheaper.
        </p>
        <div className="mt-6">
          <div className="flex items-center">
            <div className="w-28 shrink-0 border-r-2 border-slate-200 py-3 pr-2 text-right text-slate-700 transition duration-200 dark:border-slate-800 dark:text-slate-300">
              CI
            </div>
            <div className="flex-grow py-1.5 font-semibold">
              <div className="w-full flex-grow items-center justify-end rounded-r-lg border border-l-0 border-slate-200 bg-slate-100 px-4 py-2 text-right text-slate-900 transition duration-200 dark:border-slate-800 dark:bg-slate-700 dark:text-white">
                <span className="drop-shadow-sm">$6k</span>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-28 shrink-0 border-r-2 border-slate-200 py-3 pr-2 text-right font-medium text-slate-700 transition duration-200 dark:border-slate-800 dark:text-slate-300">
              CI + Nx Cloud
            </div>
            <div className="flex-grow py-1.5 font-semibold">
              <div className="w-1/2 rounded-r-lg border border-l-0 border-slate-200 bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-right text-white transition duration-200 dark:border-slate-800">
                <span className="drop-shadow-sm">$3.2k</span>
              </div>
            </div>
          </div>
        </div>
        <p className="z-10 mt-6 text-xs text-slate-400 transition duration-200 dark:text-slate-600">
          <span className="underline">Cost per month for CI compute.</span> Data
          collected based on a typical month of CI runs measured on the Nx OSS
          monorepo.
        </p>
      </Card>
    </div>
  );
}
//

//
export function IntegratesToYouCurrentCiProvider(): JSX.Element {
  return (
    <div className="col-span-2 h-fit sm:h-[225px]">
      <Card>
        <div className="relative z-20">
          <p className="text-2xl text-slate-900 dark:text-slate-100">
            Works with your current CI
          </p>
          <p className="mt-2 max-w-md text-slate-600 dark:text-slate-400">
            Use your current CI provider, export your compute and slash your CI
            bill by using Nx Agents to save time, improve performance and
            ramp-up your developer experience.
          </p>
          <div className="mt-4 flex items-center">
            <Link
              href="/ci/recipes/set-up?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_ci_for_monorepos"
              title="Add Nx Cloud to your CI workflow"
              prefetch={false}
              className="group font-semibold leading-6 text-slate-950 dark:text-white"
            >
              Enable faster CI with a single line of code{' '}
              <span
                aria-hidden="true"
                className="inline-block transition group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>
        <div className="hidden sm:block">
          <CiProviderVerticalMarquees />
        </div>
      </Card>
    </div>
  );
}

export function CiProviderVerticalMarquees(): JSX.Element {
  const ICON_DATA = [
    {
      Icon: GitHubIcon,
    },
    {
      Icon: JenkinsIcon,
    },
    {
      Icon: BitbucketIcon,
    },
    {
      Icon: AzureDevOpsIcon,
    },
    {
      Icon: TravisCiIcon,
    },
    {
      Icon: GitlabIcon,
    },
  ];
  const ICON_DATA_REVERSED = ICON_DATA.reverse();
  return (
    <div className="bg-background absolute inset-y-0 right-0 flex h-full w-40 flex-col items-center justify-center gap-4 overflow-hidden">
      <div className="flex flex-row gap-6 [perspective:300px]">
        <Marquee
          className="h-96 justify-center overflow-hidden [--duration:60s] [--gap:1rem]"
          vertical
        >
          {ICON_DATA.map((data, idx) => (
            <data.Icon
              key={'ci-provider-icon-1-' + idx}
              aria-hidden="true"
              className="mx-auto size-8"
            />
          ))}
        </Marquee>
        <Marquee
          className="hidden h-96 justify-center overflow-hidden [--duration:60s] [--gap:1rem] md:flex"
          vertical
          reverse
        >
          {ICON_DATA_REVERSED.map((data, idx) => (
            <data.Icon
              key={'ci-provider-icon-2-' + idx}
              aria-hidden="true"
              className="mx-auto size-8"
            />
          ))}
        </Marquee>
      </div>
    </div>
  );
}

export function AiSection(): JSX.Element {
  return (
    <div className="h-fit sm:h-[225px]">
      <Card className="flex items-center gap-8">
        <PulseLine className="left-full -translate-x-[1px]" />
        <div className="relative hidden h-full w-64 shrink-0 overflow-hidden lg:block">
          <img
            src="/images/home/ci-with-ai-light.avif"
            alt="ci with ai illustration"
            className="absolute inset-0 block -translate-y-[85px] scale-150 transform dark:hidden"
          />
          <img
            src="/images/home/ci-with-ai-dark.avif"
            alt="ci with ai illustration"
            className="absolute inset-0 hidden -translate-y-[85px] scale-150 transform dark:block"
          />
        </div>
        <div className="grow">
          <p className="text-2xl text-slate-900 dark:text-slate-100">
            AI for your CI
          </p>
          <p className="mt-2text-slate-600 dark:text-slate-400">
            Identify and <Strong> resolve task failures</Strong> instantly with
            intelligent explanations and actionable solutions. Set your desired
            CI run time, and Nx Cloud will match it. Our{' '}
            <Strong>custom AI model</Strong> analyzes your previous runs, then{' '}
            <Strong>dynamically predicts and allocates</Strong> the optimal
            number of agents. The more you use it, the smarter it gets. Take the
            guesswork out of your work.
          </p>
          <div className="mt-4 flex items-center">
            <Link
              href="/ci/concepts/nx-cloud-ai?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_ci_for_monorepos"
              title="Add AI to your CI with Nx Cloud"
              prefetch={false}
              className="group font-semibold leading-6 text-slate-950 dark:text-white"
            >
              Learn more{' '}
              <span
                aria-hidden="true"
                className="inline-block transition group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
