import { SparklesIcon } from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common';
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  Variants,
} from 'framer-motion';
import Link from 'next/link';
import { useEffect } from 'react';

function Counter({
  value,
  duration = 2,
}: {
  value: number;
  duration?: number;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    const animation = animate(count, value, {
      type: 'tween',
      ease: 'easeOut',
      duration,
    });

    return animation.stop;
  }, []);

  return <motion.span>{rounded}</motion.span>;
}

export function NxWithCi(): JSX.Element {
  const ciBar: Variants = {
    start: {
      width: 0,
    },
    end: {
      width: '100%',
      transition: {
        type: 'tween',
        ease: 'easeOut',
        duration: 1.2,
      },
    },
  };
  const nxBar: Variants = {
    start: {
      width: 0,
    },
    end: {
      width: '50%',
      transition: {
        type: 'tween',
        ease: 'easeOut',
        duration: 1.2,
      },
    },
  };

  return (
    <article id="nx-is-fast" className="relative pt-12 sm:pt-28">
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:grid sm:grid-cols-2 sm:gap-8 sm:px-6 lg:px-8 lg:pb-16">
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
              <div className="w-28 shrink-0 border-r border-slate-200 py-3 text-slate-700 dark:border-slate-500 dark:text-slate-400">
                CI without Nx
              </div>
              <div className="flex-grow py-1">
                <motion.div
                  initial="start"
                  whileInView="end"
                  variants={ciBar}
                  viewport={{ once: true }}
                  className="flex-grow items-center justify-end rounded-r-lg bg-slate-200 px-4 py-2 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                >
                  <Counter value={90}></Counter>
                  <span className="ml-1">minutes</span>
                </motion.div>
              </div>
            </div>
            <div className="flex">
              <div className="w-28 shrink-0 border-r border-slate-200 py-3 font-medium text-slate-700 dark:border-slate-500 dark:text-slate-400">
                CI with Nx
              </div>
              <div className="flex flex-grow gap-4 py-1 font-medium">
                <motion.div
                  initial="start"
                  whileInView="end"
                  variants={nxBar}
                  viewport={{ once: true }}
                  className="rounded-r-lg bg-blue-500 dark:bg-sky-500"
                />
                <div className="flex items-center text-slate-700 dark:text-slate-400">
                  <Counter value={10}></Counter>
                  <span className="ml-1">minutes</span>
                </div>
              </div>
            </div>
            <div className="flex w-full justify-end">
              <a
                href="https://www.youtube.com/watch?v=KPCMg_Dn0Eo"
                target="_blank"
                className="text-sm font-medium hover:underline"
                title="Find out how to reduce CI time with Nx"
                rel="noreferrer"
              >
                Find out how
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8 lg:pb-16">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-3">
          <div className="relative">
            <dt className="text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">
              <div className="group relative">
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 opacity-25 blur-sm transition duration-1000 group-hover:opacity-90 group-hover:duration-200"></div>
                <div className="relative flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 text-lg shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-slate-800/40 dark:bg-slate-800">
                  <NxCacheIcon className="h-8 w-8" aria-hidden="true" />
                  <Link
                    href="/ci/features/remote-cache"
                    title="Discover Nx Replay"
                  >
                    <span className="absolute inset-0"></span>Nx Replay
                  </Link>
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
              <div className="group relative">
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 opacity-25 blur-sm transition duration-1000 group-hover:opacity-90 group-hover:duration-200"></div>
                <div className="relative flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 text-lg shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-slate-800/40 dark:bg-slate-800">
                  <NxAgentsIcon className="h-8 w-8" aria-hidden="true" />
                  <a
                    href="/ci/features/distribute-task-execution"
                    title="Discover Nx Agents"
                  >
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
              <div className="group relative opacity-70">
                <div className="absolute -inset-1 rounded-lg bg-slate-500 opacity-25 blur-sm"></div>
                <div className="relative flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 text-lg shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-slate-800/40 dark:bg-slate-800">
                  <SparklesIcon
                    className="block h-8 w-8 sm:hidden md:block"
                    aria-hidden="true"
                  />
                  {/*<a href="/ci/features/tusky" title="Discover Tusky">*/}
                  <span className="absolute inset-0"></span>Tusky
                  {/*</a>*/}
                  <div className="flex-grow" />
                  <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/20">
                    Coming soon
                  </span>
                </div>
              </div>
            </dt>
            <dd className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-400">
              A powerful Artificial Intelligence equipped with context of your
              workspace, commit history, and historical build timing data.
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export const NxAgentsIcon = (props: any) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    fill="none"
    {...props}
  >
    <path
      strokeLinejoin="round"
      d="M21 12.5h-4m4 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm-2 8h-5v-3m5 3a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm-16-8h4m-4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2 8h5v-3m-5 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0-17h5v4m-5-4a1 1 0 1 0-2 0 1 1 0 0 0 2 0Zm14 0h-5v4m5-4a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm-3 14H8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1Zm-5-8h2l-.667 1.875L14 11.346 11.333 15.5l.334-2.77H10l1-3.23Z"
    />
  </svg>
);

export const NxCacheIcon = (props: any) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    fill="none"
    {...props}
  >
    <path
      strokeLinecap="round"
      d="m8.625 2.621-.014.004c-.317.09-.622.22-.907.387m4.796-.965-.014-.002a3.958 3.958 0 0 0-.986.002m3.875.574.014.004c.317.09.622.22.907.387m-.92 18.367.013-.004c.317-.09.622-.22.907-.387m-4.796.965.014.002c.328.04.659.04.986-.002m-3.875-.574-.014-.004a3.96 3.96 0 0 1-.907-.387M21.38 8.625l-.004-.014a3.96 3.96 0 0 0-.387-.907m.965 4.796.002-.014c.04-.328.04-.659-.002-.986m-.574 3.875-.004.014a3.96 3.96 0 0 1-.387.907m-18.367-.92.004.013c.09.317.22.622.387.907M2.047 11.5l-.002.014c-.04.328-.04.659.002.986m.574-3.875.004-.014c.09-.317.22-.622.387-.907M7.5 10.516h9m-9 0a1.5 1.5 0 0 1 0-3h9a1.5 1.5 0 0 1 0 3m-9 0a1.5 1.5 0 0 0 0 3m9-3a1.5 1.5 0 0 1 0 3m-6.412-4.5h.01m-1.883 0h.01m-.725 4.5h9m-9 0a1.5 1.5 0 0 0 0 3h9a1.5 1.5 0 0 0 0-3m-6.412-1.5h.01m-1.883 0h.01m1.863 3h.01m-1.883 0h.01M3 4.516a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Zm15 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Zm-15 15a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Zm15 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z"
    />
  </svg>
);

export const NxWorkflowsIcon = (props: any) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    fill="none"
    {...props}
  >
    <g clipPath="url(#a)">
      <path
        strokeLinecap="round"
        d="M13.315 10h7.37m-7.37-6h7.37m-5.95-1v2m-1.42 2h7.37m-1.159-1v2M17 9v2M4.678 3.5h.75m2.29 0h.75m-3.79 7h.75m2.29 0h.75m1.605-5.395v.75m0 2.29v.75m-7-3.79v.75m0 2.29v.75M3.698 21h6a1 1 0 0 0 1-1v-.763a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1Zm0-4.605h6a1 1 0 0 0 1-1v-.763a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v.763a1 1 0 0 0 1 1Zm14.723.976a1.42 1.42 0 1 1-2.842 0 1.42 1.42 0 0 1 2.842 0ZM2.499.499H21.5a2 2 0 0 1 2 2V21.5a2 2 0 0 1-2 2h-19a2 2 0 0 1-2-2v-19a2 2 0 0 1 2-2ZM20.11 16.087l.599.126a.6.6 0 0 1 .476.587v1.133a.6.6 0 0 1-.477.588l-.594.123a.6.6 0 0 0-.448.773l.19.583a.6.6 0 0 1-.27.706l-.983.566a.6.6 0 0 1-.747-.12l-.408-.456a.6.6 0 0 0-.896.001l-.403.454a.6.6 0 0 1-.748.12l-.98-.565a.6.6 0 0 1-.27-.704l.19-.586a.6.6 0 0 0-.449-.773l-.594-.124a.6.6 0 0 1-.478-.588l.001-1.13a.6.6 0 0 1 .476-.587l.6-.127a.6.6 0 0 0 .446-.775l-.19-.576a.6.6 0 0 1 .27-.707l.978-.567a.6.6 0 0 1 .747.119l.408.454a.6.6 0 0 0 .894 0l.405-.454a.6.6 0 0 1 .747-.12l.982.567a.6.6 0 0 1 .27.707l-.19.578a.6.6 0 0 0 .446.774Z"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="transparent" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
