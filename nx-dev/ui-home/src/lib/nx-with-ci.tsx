import {
  CloudArrowDownIcon,
  CogIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common';
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
              Speed up your CI from 90 mins to 10 mins with 1 flag
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
        <div className="flex flex-row content-between gap-6 lg:gap-28">
          <div className="flex flex-col justify-center">
            <div className="text-lg text-slate-400">Most workspaces see</div>
            <div
              aria-hidden="true"
              className="my-2 text-4xl font-semibold text-slate-800 drop-shadow-sm dark:text-slate-100 dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)] xl:text-6xl"
            >
              <Counter from={0} to={3} round={0} progress={progress} />{' '}
              <span className="-ml-2 text-lg xl:-ml-3 xl:text-3xl">x</span>
              <span className="mx-4 text-2xl xl:text-5xl">to</span>
              <Counter from={0} to={14} round={0} progress={progress} />{' '}
              <span className="-ml-2 text-lg xl:-ml-3 xl:text-3xl">x</span>
            </div>
            <div className="text-sm text-slate-500">
              <span className="sr-only">3 times </span>reduction in CI time
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <div className="text-lg text-slate-400">Average</div>
            <div
              aria-hidden="true"
              className="my-2 text-4xl font-bold text-slate-800 drop-shadow-sm dark:text-slate-100 dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)] xl:text-6xl"
            >
              <Counter from={0} to={2.5} round={1} progress={progress} />{' '}
              <span className="-ml-2 text-lg xl:text-3xl">x</span>
            </div>
            <div className="text-sm text-slate-500">
              <span className="sr-only">2.5 times </span>reduction in
              computation time
            </div>
          </div>
        </div>
      </motion.div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8 lg:pb-16">
        <dl className="grid grid-cols-1 gap-16 sm:grid-cols-3 items-stretch">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex flex-col-reverse rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm  transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-slate-800/40 dark:bg-slate-800">
              <dd className="mt-4 text-slate-400 dark:text-slate-500 sr-only">
                <p>DESCRIPTION HERE - CHANGE TEXT</p>
              </dd>
              <dt className="py-8">
                <div className="flex items-center text-slate-800 dark:text-slate-200 gap-4">
                  <CloudArrowDownIcon
                    className="h-8 w-8 flex-none "
                    aria-hidden="true"
                  />
                  <div className="font-semibold text-lg">
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href="/ci/features/nx-cache"
                    >
                      <span className="absolute inset-0"></span>Nx Cache
                    </a>
                  </div>
                </div>
                <div className="mt-2 text-base text-slate-600 dark:text-slate-400">
                  Built-in local and remote caching to speed up your tasks and
                  save you time and money.
                </div>
              </dt>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-rose-500 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex flex-col-reverse rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm  transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-slate-800/40 dark:bg-slate-800">
              <dd className="mt-4 text-slate-400 dark:text-slate-500 sr-only">
                <p>DESCRIPTION HERE - CHANGE TEXT</p>
              </dd>
              <dt className="flex items-center space-x-4 py-8">
                <ServerStackIcon
                  className="h-8 w-8 flex-none text-slate-800 dark:text-slate-200"
                  aria-hidden="true"
                />
                <div className="flex-auto">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    <a href="/ci/features/nx-agents" title="Discover Nx Agents">
                      <span className="absolute inset-0"></span>Nx Agents{' '}
                      <span className="absolute top-2 right-2 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/20 inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        Early access
                      </span>
                    </a>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    A single flag to enable distributed computation, across
                    multiple machines. Fully managed agents, dynamically
                    allocated based on PR size.
                  </div>
                  {/* <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    A single flag to enable powerful task distribution, on any CI provider.


                    Streamline CI with dynamic task distribution across
                    machines, managed by a single flag. Works seamlessly across
                    different CI providers.
                  </div> */}
                </div>
              </dt>
            </div>
          </div>
          <div className="relative group opacity-50">
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-fuchsia-500 rounded-lg blur opacity-25 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex flex-col-reverse rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm  transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-slate-800/40 dark:bg-slate-800">
              <dd className="mt-4 text-slate-400 dark:text-slate-500 sr-only">
                <p>DESCRIPTION HERE - CHANGE TEXT</p>
              </dd>
              <dt className="flex items-center space-x-4 py-8">
                <CogIcon
                  className="h-8 w-8 flex-none text-slate-800 dark:text-slate-200"
                  aria-hidden="true"
                />
                <div className="flex-auto">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {/*<a target="_blank" rel="noreferrer" href="#">*/}
                    <span className="absolute inset-0"></span>Nx Workflows
                    <span className="absolute top-2 right-2 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/20 inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                      Coming soon
                    </span>
                    {/*</a>*/}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    Next generation, fully managed CI solution with distribution
                    at its core, designed from the ground up for monorepos.
                  </div>
                </div>
              </dt>
            </div>
          </div>
        </dl>
      </div>
    </article>
  );
}
