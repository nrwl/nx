import {
  AcademicCapIcon,
  ArrowRightCircleIcon,
  BeakerIcon,
  ChartBarIcon,
  CloudArrowDownIcon,
  CubeTransparentIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import { CogIcon } from '@heroicons/react/24/solid';
import {
  animate,
  motion,
  MotionValue,
  useAnimation,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';

function Counter({
  from = 0,
  to = 10,
  round = 0,
  progress,
}: {
  from: number;
  to: number;
  round: number;
  progress: MotionValue<number>;
}): JSX.Element {
  const ref = useRef<any>();
  const value = useTransform(progress, [0, 1000], [from, to], {
    clamp: false,
  });

  const { format: formatNumber } = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: round,
    maximumFractionDigits: round,
  });

  useEffect(() => {
    return value.onChange((v) => {
      if (ref !== undefined && ref.current !== undefined)
        ref.current.firstChild.data = formatNumber(
          round === 0 ? Math.round(v) : Number(v.toFixed(round))
        );
    });
  }, [formatNumber, round, value]);

  return <span ref={ref}>{formatNumber(value.get())}</span>;
}

export function NxIsFast(): JSX.Element {
  const progress: MotionValue<number> = useMotionValue(0);
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true });

  useEffect(() => {
    if (!inView) return;
    controls.start('visible');
    animate(progress, 1000, {
      type: 'spring',
      damping: 50,
    });
  }, [controls, inView, progress]);

  return (
    <article
      id="nx-is-fast"
      className="relative bg-gray-50 py-28 dark:bg-slate-800/40"
    >
      <motion.div
        ref={ref}
        animate={controls}
        className="mx-auto max-w-7xl px-4 pt-12 sm:grid sm:grid-cols-2 sm:gap-8 sm:px-6 lg:px-8 lg:pt-16"
      >
        <div>
          <header>
            <h1 className="text-lg font-semibold tracking-tight text-blue-500 dark:text-sky-500">
              Nx is fast
            </h1>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
              Don't waste your time
            </p>
          </header>
          <div className="mt-8 flex gap-16 font-normal">
            <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
              Nx makes scaling easy. Modern techniques such as{' '}
              <span className="font-semibold">distributed task execution</span>{' '}
              and <span className="font-semibold">computation caching</span>{' '}
              make sure your CI times remain fast, even as you keep adding
              projects to your workspace.
            </p>
          </div>
        </div>
        <div className="flex flex-row content-between gap-6">
          <div className="flex flex-col justify-center">
            <div className="text-lg text-slate-400">Up to</div>
            <div
              aria-hidden="true"
              className="my-2 text-4xl font-semibold text-slate-800 drop-shadow-sm dark:text-slate-100 dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)] lg:text-6xl"
            >
              <Counter from={0} to={3} round={0} progress={progress} />{' '}
              <span className="-ml-2 text-lg lg:-ml-3 lg:text-3xl">x</span>
              <span className="mx-4 text-2xl lg:text-5xl">to</span>
              <Counter from={0} to={14} round={0} progress={progress} />{' '}
              <span className="-ml-2 text-lg lg:-ml-3 lg:text-3xl">x</span>
            </div>
            <div className="text-sm text-slate-500">
              <span className="sr-only">3 times </span>reduction in CI time for
              mid-size projects with standard CI setups
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <div className="text-lg text-slate-400">Average</div>
            <div
              aria-hidden="true"
              className="my-2 text-4xl font-bold text-slate-800 drop-shadow-sm dark:text-slate-100 dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)] lg:text-6xl"
            >
              <Counter from={0} to={2.5} round={1} progress={progress} />{' '}
              <span className="-ml-2 text-lg lg:text-3xl">x</span>
            </div>
            <div className="text-sm text-slate-500">
              <span className="sr-only">2,5 times </span>reduction in
              computation time per workspace
            </div>
          </div>
        </div>
      </motion.div>
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        <dl className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4">
          <div key="Never rebuild the same code twice" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <CogIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <CloudArrowDownIcon
                  className="absolute -top-2 -right-4 h-8 w-8 text-purple-500 opacity-0 transition-opacity group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <CogIcon
                  className="absolute bottom-0 right-0 h-8 w-8 text-purple-500 opacity-0 transition-opacity group-hover:opacity-100 group-hover:motion-safe:animate-spin dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-gray-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Never rebuild the same code twice
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              Nx is smart! It can figure out whether the same computation has
              run before and{' '}
              <span className="font-medium">
                just restores the files and the terminal output
              </span>
              from its cache.
            </dd>
            <Link href="/core-features/cache-task-results">
              <a
                title="Learn how to setup Distributed Task Executions"
                className="mt-4 inline-flex items-center font-medium text-blue-500 transition hover:text-blue-600 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:text-sky-500 dark:hover:text-sky-400"
              >
                Enable caching now{' '}
                <ArrowRightCircleIcon className="ml-2 h-5 w-5" />
              </a>
            </Link>
          </div>
          <div key="Distributed task execution" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <ServerStackIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <CogIcon
                  className="absolute bottom-0 right-0 h-8 w-8 text-purple-500 opacity-0 transition-opacity group-hover:opacity-100 group-hover:motion-safe:animate-spin dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-gray-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Distributed task execution (DTE)
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              Smart, automated, dynamic distribution of tasks across multiple
              machines to get{' '}
              <span className="font-medium">
                maximum parallelization and CPU efficient
              </span>{' '}
              CI runs.
            </dd>
            <Link href="/core-features/distribute-task-execution">
              <a
                title="Learn how to setup Distributed Task Executions"
                className="mt-4 inline-flex items-center font-medium text-blue-500 transition hover:text-blue-600 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:text-sky-500 dark:hover:text-sky-400"
              >
                Enable DTE <ArrowRightCircleIcon className="ml-2 h-5 w-5" />
              </a>
            </Link>
          </div>
          <div key="Computation caching" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <CloudArrowDownIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <CubeTransparentIcon
                  className="absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-8 group-hover:-translate-y-1 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <CubeTransparentIcon
                  className="5 absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-5 group-hover:translate-y-6 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-gray-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Remote distributed caching
              </p>
            </dt>
            <dd className="mt-2 text-base text-gray-500 dark:text-slate-400">
              <span className="font-medium">
                Share your local computation cache
              </span>{' '}
              with team mates and your CI system for maximum efficiency.
            </dd>
            <Link href="/concepts/how-caching-works">
              <a
                title="Learn how to setup Distributed Task Executions"
                className="mt-4 inline-flex items-center font-medium text-blue-500 transition hover:text-blue-600 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:text-sky-500 dark:hover:text-sky-400"
              >
                Learn how caching works{' '}
                <ArrowRightCircleIcon className="ml-2 h-5 w-5" />
              </a>
            </Link>
          </div>
          <div key="Efficient execution" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <AcademicCapIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <BeakerIcon
                  className="absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-8 group-hover:-translate-y-1 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <ChartBarIcon
                  className="5 absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-5 group-hover:translate-y-6 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-gray-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Only touch what changed
              </p>
            </dt>
            <dd className="mt-2 text-base text-gray-500 dark:text-slate-400">
              Nothing is faster than not running a task. Nx analyzes your
              project graph and can{' '}
              <span className="font-medium">
                diff it against a baseline to determine which projects changed
              </span>{' '}
              and where tasks need to be re-run.
            </dd>
            <Link href="/concepts/affected">
              <a
                title="Learn how to Nx affected commands allow you to determine what changed"
                className="mt-4 inline-flex items-center font-medium text-blue-500 transition hover:text-blue-600 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:text-sky-500 dark:hover:text-sky-400"
              >
                Learn about affected commands{' '}
                <ArrowRightCircleIcon className="ml-2 h-5 w-5" />
              </a>
            </Link>
          </div>
        </dl>
      </div>
    </article>
  );
}
