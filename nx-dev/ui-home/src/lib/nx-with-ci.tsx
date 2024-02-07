import {
  CloudArrowDownIcon,
  CogIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import {
  animate,
  motion,
  MotionValue,
  useAnimation,
  useMotionValue,
  useTransform,
} from 'framer-motion';
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

export function NxWithCi(): JSX.Element {
  const progress: MotionValue<number> = useMotionValue(0);
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true });

  useEffect(() => {
    if (!inView) return;
    controls.start('visible');
    animate(progress, 1000, {
      type: 'spring',
      damping: 100,
    });
  }, [controls, inView, progress]);

  return (
    <article id="nx-is-fast" className="relative pt-12 sm:pt-28">
      <motion.div
        ref={ref}
        animate={controls}
        className="mx-auto max-w-7xl px-4 pb-12 sm:grid sm:grid-cols-2 sm:gap-8 sm:px-6 lg:px-8 lg:pb-16"
      >
        <div>
          <header>
            <SectionHeading as="h1" variant="title" id="nx-is-fast">
              From 90 to 10 minutes
            </SectionHeading>
            <SectionHeading
              as="p"
              variant="display"
              id="nx-ci"
              className="mt-4"
            >
              Effortless, Fast CI
            </SectionHeading>
          </header>
          <div className="mt-8 flex gap-16 font-normal">
            <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
              Nx comes with the building blocks to not only scale your monorepo
              locally and provide great DX while developing, but also to address
              one of the major pain points:{' '}
              <span className="font-bold">fast, maintainable CI.</span>
            </p>
          </div>
        </div>
        <div className="flex items-end">
          <div className="w-full">
            <div className="flex">
              <div className="shrink-0 w-28 border-r border-slate-200 dark:border-slate-500 py-3 text-slate-700 dark:text-slate-400">
                CI without Nx
              </div>
              <div className="flex-grow py-1">
                <motion.div
                  initial={{ display: 'none', width: 0 }}
                  variants={{ visible: { display: 'flex', width: '90%' } }}
                  transition={{ type: 'tween', duration: 1 }}
                  className="flex-grow items-center justify-end text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 py-2 px-4 rounded-r-lg"
                >
                  <Counter from={0} to={90} round={0} progress={progress} />
                  <span className="ml-1">minutes</span>
                </motion.div>
              </div>
            </div>
            <div className="flex">
              <div className="shrink-0 font-medium w-28 border-r border-slate-200 dark:border-slate-500 py-3 text-slate-700 dark:text-slate-400">
                CI with Nx
              </div>
              <div className="flex-grow flex gap-4 py-1 font-medium">
                <motion.div
                  initial={{ display: 'none', width: 0 }}
                  variants={{ visible: { display: 'flex', width: '10%' } }}
                  transition={{ type: 'tween', duration: 1 }}
                  className="bg-blue-500 dark:bg-sky-500 rounded-r-lg"
                />
                <div className="flex items-center text-slate-700 dark:text-slate-400">
                  <Counter from={0} to={10} round={0} progress={progress} />
                  <span className="ml-1">minutes</span>
                </div>
              </div>
            </div>
            <div className="flex w-full justify-end">
              <a
                href="https://www.youtube.com/watch?v=KPCMg_Dn0Eo"
                target="_blank"
                className="hover:underline text-sm font-medium"
                title="Find out how to reduce CI time with Nx"
              >
                Find out how
              </a>
            </div>
          </div>
        </div>
      </motion.div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8 lg:pb-16">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-3">
          <div className="relative">
            <dt className="text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur-sm opacity-25 group-hover:opacity-90 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex gap-4 items-center rounded-lg border border-slate-200 bg-white p-4 text-lg shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-slate-800/40 dark:bg-slate-800">
                  <CloudArrowDownIcon className="h-8 w-8" aria-hidden="true" />
                  <a
                    href="/ci/features/remote-cache"
                    title="Discover Nx Replay"
                  >
                    <span className="absolute inset-0"></span>Nx Replay
                  </a>
                </div>
              </div>
            </dt>
            <dd className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-400">
              Built-in local and remote caching to speed up your tasks and save
              you time and money.
            </dd>
          </div>
          <div className="relative">
            <dt className="text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-rose-500 rounded-lg blur-sm opacity-25 group-hover:opacity-90 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex gap-4 items-center rounded-lg border border-slate-200 bg-white p-4 text-lg shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-slate-800/40 dark:bg-slate-800">
                  <ServerStackIcon className="h-8 w-8" aria-hidden="true" />
                  <a href="/ci/features/nx-agents" title="Discover Nx Agents">
                    <span className="absolute inset-0"></span>Nx Agents
                  </a>
                </div>
              </div>
            </dt>
            <dd className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-400">
              A single line to enable distributed computation, across multiple
              machines. Fully managed agents, dynamically allocated based on PR
              size.
            </dd>
          </div>
          <div className="relative">
            <dt className="text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">
              <div className="relative group opacity-70">
                <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-fuchsia-500 rounded-lg blur-sm opacity-25"></div>
                <div className="relative flex gap-4 items-center rounded-lg border border-slate-200 bg-white p-4 text-lg shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-slate-800/40 dark:bg-slate-800">
                  <CogIcon className="h-8 w-8" aria-hidden="true" />
                  {/*<a href="/ci/features/nx-workflows" title="Discover Nx Workflows">*/}
                  <span className="absolute inset-0"></span>Nx Workflows
                  {/*</a>*/}
                  <div className="flex-grow" />
                  <span className="dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/20 inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                    Coming soon
                  </span>
                </div>
              </div>
            </dt>
            <dd className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-400">
              Next generation, fully managed CI solution with distribution at
              its core, designed from the ground up for monorepos.
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
