import {
  ArrowLongRightIcon,
  ArrowsRightLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  DocumentIcon,
  InboxArrowDownIcon,
  LockClosedIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { SectionHeading } from './elements/section-tags';
import { BentoGrid, BentoGridItem } from './elements/bento-grid';
import { cx } from '@nx/nx-dev/ui-primitives';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export function UnderstandWorkspace(): JSX.Element {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading as="h2" variant="title" id="deep-understanding">
            Deep understanding of your workspace
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            Nx Cloud knows your build tools, how your projects relate to each
            other, and what every task does.
          </SectionHeading>
        </div>
        {/*FEATURES CONTAINER*/}
        <BentoGrid className="mx-auto mt-20 w-full md:auto-rows-[22rem]">
          {items.map((item, i) => (
            <BentoGridItem
              key={i}
              title={item.title}
              description={item.description}
              header={item.header}
              className={cx('[&>p:text-lg]', item.className)}
              icon={item.icon}
            />
          ))}
        </BentoGrid>
      </div>
    </section>
  );
}

const Caching = () => {
  const variants = {
    hidden: {
      opacity: 0,
      transition: {
        when: 'afterChildren',
      },
    },
    visible: {
      opacity: 1,
    },
  };
  const items = [
    {
      cache: 'remote',
      target: 'build',
      project: 'website',
    },
    {
      cache: 'remote',
      target: 'test',
      project: 'express',
    },
    {
      cache: 'remote',
      target: 'build',
      project: 'eslint',
    },
    {
      cache: 'remote',
      target: 'lint',
      project: 'autoloan',
    },
    {
      cache: 'remote',
      target: 'test',
      project: 'website',
    },
    {
      cache: 'remote',
      target: 'lint',
      project: 'website',
    },
    {
      cache: 'remote',
      target: 'build-base',
      project: 'express',
    },
    {
      cache: 'remote',
      target: 'build',
      project: 'express',
    },
    {
      cache: 'remote',
      target: 'lint',
      project: 'express',
    },
    {
      cache: 'remote',
      target: 'test',
      project: 'autoloan',
    },
  ];
  return (
    <motion.div
      initial="hidden"
      variants={variants}
      whileInView="visible"
      viewport={{ once: true }}
      className="flex h-full min-h-[12rem] w-full flex-1 flex-col gap-2"
    >
      <motion.div className="flex items-center gap-1.5 text-center text-sm italic">
        <SparklesIcon aria-hidden="true" className="h-4 w-4" />
        <span className="font-semibold">
          <Counter value={items.length + 123} duration={5} />
        </span>
        tasks replayed instantly with cache
      </motion.div>
      <div className="flex flex-1 flex-col divide-y divide-neutral-100 overflow-auto rounded-lg border border-neutral-100 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-950">
        {items.map((i, idx) => (
          <div
            key={`project-${i}-${idx}`}
            className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40"
          >
            <div className="m-1 h-2.5 w-2.5 flex-none rounded-full bg-emerald-500" />
            <div className="flex min-w-[4rem]">
              <span className="inline-flex cursor-default items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                {i.cache}
              </span>
            </div>
            <div
              className="grow truncate text-left text-sm font-medium"
              data-testid="task-target"
            >
              {i.target}
            </div>
            <span className="inline-flex cursor-default items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
              {i.project}
            </span>
            <div className="text-xs">&lt; 1s</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const FlakyTasks = () => {
  const variants = {
    hidden: {
      opacity: 0,
      transition: {
        when: 'afterChildren',
      },
    },
    visible: {
      opacity: 1,
    },
  };
  const itemVariants = {
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.2,
        duration: 0.275,
        ease: 'easeOut',
        when: 'beforeChildren',
        staggerChildren: 0.3,
      },
    }),
    hidden: {
      opacity: 0,
      x: -100,
      transition: {
        when: 'afterChildren',
      },
    },
  };
  return (
    <motion.div
      initial="hidden"
      variants={variants}
      whileInView="visible"
      viewport={{ once: true }}
      className="flex h-full min-h-[12rem] w-full flex-1 flex-col gap-2"
    >
      <motion.div className="flex items-center gap-1.5 text-center text-sm">
        Running
        <ChevronRightIcon aria-hidden="true" className="h-3 w-3" />
        <code className="text-xs font-medium">
          nx affected --targets=e2e,test
        </code>
      </motion.div>
      <div className="flex flex-1 flex-col divide-y divide-neutral-100 overflow-auto rounded-lg border border-neutral-100 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-950">
        <motion.div
          custom={1}
          variants={itemVariants}
          className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40"
        >
          <div className="m-1 h-2.5 w-2.5 flex-none rounded-full bg-emerald-500" />
          <div className="flex min-w-[5rem]">
            <span className="inline-flex cursor-default items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
              miss
            </span>
          </div>
          <div className="grow truncate text-left text-sm font-medium">
            test
          </div>
          <motion.span
            custom={3}
            variants={itemVariants}
            className="inline-flex cursor-default items-center rounded-md bg-yellow-400/10 px-2 py-1 text-xs font-medium text-yellow-500 ring-1 ring-inset ring-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20"
          >
            flaky
          </motion.span>
          <motion.span
            custom={2}
            variants={itemVariants}
            className="inline-flex cursor-default items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
          >
            1 retry
          </motion.span>
          <span className="inline-flex cursor-default items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
            website
          </span>
        </motion.div>
        <motion.div
          custom={2}
          variants={itemVariants}
          className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40"
        >
          <div className="flex items-center gap-2">
            <div className="m-1 h-2.5 w-2.5 flex-none rounded-full bg-red-500"></div>
            <div className="flex min-w-[5rem]">
              <span className="whitespace-nowrap text-sm font-medium">
                Failed
              </span>
            </div>
          </div>
          <div className="grow truncate text-left text-sm font-medium">e2e</div>
          <span className="inline-flex cursor-default items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
            1 retry
          </span>
          <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20">
            website
          </span>
        </motion.div>
        <motion.div
          custom={3}
          variants={itemVariants}
          className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40"
        >
          <div className="flex items-center gap-2">
            <div className="flex-none animate-pulse rounded-full bg-yellow-500/20 p-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
            </div>
            <div className="flex min-w-[5rem]">
              <span className="whitespace-nowrap text-sm font-medium">
                In progress
              </span>
            </div>
          </div>
          <div className="grow truncate text-left text-sm font-medium">
            test
          </div>
          <motion.span
            custom={15}
            variants={itemVariants}
            className="inline-flex cursor-default items-center rounded-md bg-yellow-400/10 px-2 py-1 text-xs font-medium text-yellow-500 ring-1 ring-inset ring-yellow-400/20"
          >
            flaky
          </motion.span>
          <motion.span
            custom={10}
            variants={itemVariants}
            className="inline-flex cursor-default items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
          >
            1 retry
          </motion.span>
          <span className="inline-flex cursor-default items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
            ui-cdk
          </span>
        </motion.div>
        <motion.div
          custom={4}
          variants={itemVariants}
          className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40"
        >
          <div className="m-1 h-2.5 w-2.5 flex-none rounded-full bg-emerald-500" />
          <div className="flex min-w-[5rem]">
            <span className="inline-flex cursor-default items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
              remote
            </span>
          </div>
          <div className="grow truncate text-left text-sm font-medium">
            lint
          </div>
          <span className="inline-flex cursor-default items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
            website
          </span>
        </motion.div>
        <motion.div
          custom={5}
          variants={itemVariants}
          className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40"
        >
          <div className="flex items-center gap-2">
            <div className="flex-none animate-pulse rounded-full bg-yellow-500/20 p-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
            </div>
            <div className="flex min-w-[5rem]">
              <span className="whitespace-nowrap text-sm font-medium">
                In progress
              </span>
            </div>
          </div>
          <div className="grow truncate text-left text-sm font-medium">
            build
          </div>
          <span className="inline-flex cursor-default items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
            ui-cdk
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
};

const SplitE2eTests = () => {
  const variants = {
    hidden: {
      opacity: 0,
      transition: {
        when: 'afterChildren',
      },
    },
    visible: {
      opacity: 1,
    },
  };
  const uiDialogsTests = [
    'e2e/libs/ui-cdk/spec-1.tsx',
    'e2e/libs/ui-cdk/spec-2.tsx',
  ];
  const websiteTests = [
    'e2e/apps/website/spec-1.tsx',
    'e2e/apps/website/spec-2.tsx',
    'e2e/apps/website/spec-3.tsx',
    'e2e/apps/website/spec-4.tsx',
    'e2e/apps/website/spec-5.tsx',
    'e2e/apps/website/spec-6.tsx',
  ];

  return (
    <motion.div
      initial="hidden"
      variants={variants}
      whileInView="visible"
      viewport={{ once: true }}
      className="flex h-full min-h-[12rem] w-full flex-1 flex-col gap-2"
    >
      <motion.div className="flex items-center gap-1.5 text-center text-sm">
        Running
        <ChevronRightIcon aria-hidden="true" className="h-3 w-3" />
        <code className="text-xs font-medium">nx affected --targets=e2e</code>
      </motion.div>
      <div className="flex flex-1 flex-col divide-y divide-neutral-100 overflow-auto rounded-lg border border-neutral-100 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <div className="flex-none animate-pulse rounded-full bg-yellow-500/20 p-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
            </div>
            <div className="flex min-w-[5rem]">
              <span className="whitespace-nowrap text-sm font-medium">
                In progress
              </span>
            </div>
          </div>
          <div className="grow truncate text-left text-sm font-medium">e2e</div>
          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
            ui-cdk
          </span>
        </div>
        {uiDialogsTests.map((i, idx) => (
          <div
            key={`${i}-${idx}`}
            className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40"
          >
            <div className="w-4" />
            <ArrowLongRightIcon aria-hidden="true" className="h-4 w-4" />
            <div className="flex-none animate-pulse rounded-full bg-yellow-500/20 p-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
            </div>
            <div className="grow truncate text-left text-sm">{i}</div>
          </div>
        ))}
        <div className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <div className="flex-none animate-pulse rounded-full bg-yellow-500/20 p-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
            </div>
            <div className="flex min-w-[5rem]">
              <span className="whitespace-nowrap text-sm font-medium">
                In progress
              </span>
            </div>
          </div>
          <div className="grow truncate text-left text-sm font-medium">e2e</div>
          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
            website
          </span>
        </div>
        {websiteTests.map((i, idx) => (
          <div
            key={`${i}-${idx}`}
            className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-900/40"
          >
            <div className="w-4" />
            <ArrowLongRightIcon aria-hidden="true" className="h-4 w-4" />
            <div className="flex-none animate-pulse rounded-full bg-yellow-500/20 p-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
            </div>
            <div className="grow truncate text-left text-sm">{i}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const TaskDistribution = () => {
  const variants = {
    hidden: {
      opacity: 0,
      transition: {
        when: 'afterChildren',
      },
    },
    visible: {
      opacity: 1,
    },
  };
  const itemVariants = {
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.2,
        duration: 0.275,
        ease: 'easeOut',
        when: 'beforeChildren',
        staggerChildren: 0.3,
      },
    }),
    hidden: {
      opacity: 0,
      x: -100,
      transition: {
        when: 'afterChildren',
      },
    },
  };
  const agent1Items = ['website:build-base', 'website:build'];
  const agent2Items = ['docs:lint', 'express:test', 'website:lint'];
  const agent3Items = ['graph-client:build', 'plugin:test'];
  const nxReplayItems = [
    'graph-client:lint',
    'plugin:lint',
    'website:test',
    'vite:test',
    'vite:build',
  ];

  const notStartedTasks = ['js:build', 'js:lint'];
  return (
    <motion.div
      initial="hidden"
      variants={variants}
      whileInView="visible"
      viewport={{ once: true }}
      className="relative flex h-full min-h-[12rem] w-full flex-1 flex-col gap-2"
    >
      <div className="grid max-h-full grid-cols-2 items-stretch gap-8 overflow-hidden p-1 lg:grid-cols-3">
        <motion.div
          custom={2}
          variants={itemVariants}
          className="relative overflow-x-hidden rounded-lg bg-white p-2 ring-1 ring-neutral-100 dark:bg-slate-950 dark:ring-slate-700"
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-400">
            Main Workflow
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <p className="overflow-x-auto truncate py-2 font-mono text-xs font-medium text-slate-900 dark:text-slate-400">
              nx affected --target=build,lint,test
            </p>
            <div className="flex h-1.5 w-full flex-row rounded-full">
              <div
                title="2 tasks in completed"
                className="cursor-pointer rounded-l-full bg-green-400 dark:bg-green-600"
                style={{ flexGrow: 8 }}
              />
              <div
                title="12 tasks in progress"
                className="cursor-pointer bg-yellow-400 dark:bg-yellow-600"
                style={{ flexGrow: 12 }}
              />
              <div
                title="24 tasks not started"
                className="cursor-pointer rounded-r-full bg-slate-100 dark:bg-slate-600"
                style={{ flexGrow: 24 }}
              />
            </div>
            <div className="mt-2 flex flex-1 flex-col divide-y divide-neutral-100 overflow-auto rounded-lg border border-neutral-100 dark:divide-slate-700 dark:border-slate-700">
              {notStartedTasks.map((i, idx) => (
                <motion.div
                  key={`${i}-${idx}`}
                  custom={idx + 3}
                  variants={itemVariants}
                  className="flex w-full flex-row items-center gap-2 p-2 transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-800/40"
                >
                  <div className="text-xs">{i}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
        <motion.div
          custom={3}
          variants={itemVariants}
          className="relative flex flex-col gap-2 overflow-x-hidden rounded-lg bg-white p-2 ring-1 ring-neutral-100 dark:bg-slate-950 dark:ring-slate-700"
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-400">
            Nx Agents
          </p>
          <div className="flex flex-1 flex-col overflow-auto">
            <motion.div custom={4} variants={itemVariants} className="relative">
              <div className="sticky top-0 z-10 mt-1 rounded-md border border-neutral-100 bg-slate-50 p-2 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
                <div className="flex items-center gap-x-2 text-xs font-medium">
                  <div className="flex-none animate-pulse rounded-full bg-yellow-500/20 p-1">
                    <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  </div>
                  Agent 1<span className="flex-grow"></span>
                  <span className="mr-1 opacity-80">{agent1Items.length}</span>
                </div>
              </div>
              <ul className="my-2 overflow-y-auto overflow-x-hidden">
                {agent1Items.map((i, idx) => (
                  <motion.li
                    key={`agent-${i}-${idx}`}
                    custom={idx + 5}
                    variants={itemVariants}
                    className="truncate p-1 pl-4 text-xs"
                  >
                    {i}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            <motion.div custom={6} variants={itemVariants} className="relative">
              <div className="sticky top-0 z-10 mt-1 rounded-md border border-neutral-100 bg-slate-50 p-2 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
                <div className="flex items-center gap-x-2 text-xs font-medium">
                  <div className="flex-none animate-pulse rounded-full bg-yellow-500/20 p-1">
                    <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  </div>
                  Agent 2<span className="flex-grow"></span>
                  <span className="mr-1 opacity-80">{agent2Items.length}</span>
                </div>
              </div>
              <ul className="my-2 overflow-y-auto overflow-x-hidden">
                {agent2Items.map((i, idx) => (
                  <motion.li
                    key={`agent-${i}-${idx}`}
                    custom={idx + 7}
                    variants={itemVariants}
                    className="truncate p-1 pl-4 text-xs"
                  >
                    {i}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              custom={8}
              variants={itemVariants}
              className="relative hidden lg:block"
            >
              <div className="sticky top-0 z-10 mt-1 rounded-md border border-neutral-100 bg-slate-50 p-2 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
                <div className="flex items-center gap-x-2 text-xs font-medium">
                  <div className="flex-none animate-pulse rounded-full bg-yellow-500/20 p-1">
                    <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  </div>
                  Agent 3<span className="flex-grow"></span>
                  <span className="mr-1 opacity-80">{agent3Items.length}</span>
                </div>
              </div>
              <ul className="my-2 overflow-y-auto overflow-x-hidden">
                {agent3Items.map((i, idx) => (
                  <motion.li
                    key={`agent-${i}-${idx}`}
                    custom={idx + 9}
                    variants={itemVariants}
                    className="truncate p-1 pl-4 text-xs"
                  >
                    {i}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.div>
        <motion.div
          custom={4}
          variants={itemVariants}
          className="relative hidden flex-col gap-2 overflow-x-hidden rounded-lg bg-white p-2 ring-1 ring-neutral-100 lg:flex dark:bg-slate-950 dark:ring-slate-700"
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-400">
            Nx Replay
          </p>
          <div className="flex flex-1 flex-col divide-y divide-neutral-100 overflow-auto rounded-lg border border-neutral-100 dark:divide-slate-800 dark:border-slate-800">
            {nxReplayItems.map((i, idx) => (
              <motion.div
                key={`replay-${i}-${idx}`}
                custom={idx + 10}
                variants={itemVariants}
                className="flex w-full flex-row items-center gap-2 p-2 text-xs transition-colors ease-out hover:bg-slate-50/40 dark:hover:bg-slate-800/40"
              >
                {i}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

const ActionableErrorFeedback = () => {
  const variants = {
    hidden: {
      opacity: 0,
      transition: {
        when: 'afterChildren',
      },
    },
    visible: {
      opacity: 1,
    },
  };

  return (
    <motion.div
      initial="hidden"
      variants={variants}
      whileInView="visible"
      viewport={{ once: true }}
      className="flex h-full min-h-[12rem] w-full flex-1 flex-col gap-1"
    >
      <div className="flex items-center gap-1.5">
        {/*STATUS*/}
        <div className="flex items-center gap-2">
          <div className="m-1 h-2.5 w-2.5 flex-none rounded-full bg-red-500"></div>
          <span
            className="whitespace-nowrap text-lg font-medium"
            data-testid="status-label"
          >
            Failed
          </span>
          with code: 1
        </div>
      </div>
      {/*COMPARE & FLAKY*/}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          className="cursor-default rounded bg-white px-2 py-1 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-white/10 dark:text-slate-400 dark:ring-slate-700"
        >
          Compare to similar tasks
        </button>
        <button
          type="button"
          className="cursor-default rounded bg-white px-2 py-1 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-white/10 dark:text-slate-400 dark:ring-slate-700"
        >
          Set as "not flaky"
        </button>
      </div>
      <div>
        <div className="border-b border-neutral-100 dark:border-slate-700">
          <div className="-mb-px flex space-x-4">
            <span className="cursor-default whitespace-nowrap border-b-2 border-transparent px-0.5 py-2 text-xs font-medium text-gray-500 dark:text-slate-400">
              Attempt 1
            </span>
            <span className="cursor-default whitespace-nowrap border-b-2 border-blue-500 px-0.5 py-2 text-xs font-medium text-blue-500 dark:border-sky-600 dark:text-sky-600">
              Attempt 2
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs">Feb 23, 2024 08:57:49 - 08:57:54 (4s)</p>
      <motion.div className="terminal-output flex max-h-full min-h-[2rem] flex-col overflow-visible rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs leading-normal text-slate-800 subpixel-antialiased dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <div className="flex items-center justify-between gap-4 rounded-t-lg border-b border-slate-200 bg-slate-100 px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
          <div className="font-sans text-sm font-medium">
            <span className="group relative flex cursor-pointer items-center overflow-hidden whitespace-nowrap subpixel-antialiased dark:text-slate-300">
              <span>nx run nx-dev:build</span>
              <span className="transform opacity-0 transition-all">
                <ClipboardDocumentIcon className="h-4 w-4" />
              </span>
            </span>
          </div>
        </div>
        <div className="overflow-auto">
          <pre className="overflow-x-hidden p-1 dark:text-slate-400">
            {`nx run nx-dev:sitemap ✨ [next-sitemap]
  Loading next-sitemap config:file:///home/workflows/workspace/nx-dev/nx-dev/next-sitemap.config.js
  ❌ [next-sitemap] Unable to find export-maker.
    Make sure to build the project using "next build" command
    node:internal/process/promises:289
            triggerUncaughtException(err, true /* fromPromise */); ^
            [Error:ENOENT: no such file or directory, stat '/home/workflows/workspace/dist/nx-dev/nx-dev/.next/export-marker.json']
            errno: -2, code: 'ENOENT', syscall: 'stat', path: '/home/workflows/workspace/dist/nx-dev/nx-dev/.next/export-marker.json'
  Node.js v20.9.0 Warning: command "pnpm next-sitemap --config
  ./nx-dev/nx-dev/next-sitemap.config.js" exited with non-zero status code`}
          </pre>
        </div>
      </motion.div>
    </motion.div>
  );
};

export function Counter({
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

const items = [
  {
    title: 'Nx Agents: seamless task distribution',
    description: (
      <>
        Nx Cloud manages CI agent machines, offloading complex machine
        provisioning from your CI provider. Integration is as simple as
        initiating a distributed run on your provider, with Nx Agents handling
        the rest - streamlining operations and enhancing cost efficiency.
      </>
    ),
    header: <TaskDistribution />,
    className: 'md:col-span-2',
    icon: <ArrowsRightLeftIcon className="h-4 w-4 text-neutral-500" />,
  },
  {
    title: 'Nx Replay: secure computation cache',
    description: (
      <>
        Nx Cloud caches and restores task results, across PRs and local
        machines, drastically accelerating your CI runs.
      </>
    ),
    header: <Caching />,
    className: 'md:col-span-1',
    icon: <LockClosedIcon className="h-4 w-4 text-neutral-500" />,
  },
  {
    title: 'Atomizer: E2E test splitting',
    description: (
      <>
        Nx Cloud splits large e2e projects into fine-grained test runs, enabling
        more efficient distribution and dramatically reducing CI times.
      </>
    ),
    header: <SplitE2eTests />,
    className: 'md:col-span-1',
    icon: <ClipboardDocumentIcon className="h-4 w-4 text-neutral-500" />,
  },
  {
    title: 'Flaky task detection',
    description: (
      <>
        Nx Cloud automatically identifies flaky tasks from any tool and
        initiates a re-run of those specific tasks, optimizing resource usage
        for peak efficiency.
      </>
    ),
    header: <FlakyTasks />,
    className: 'md:col-span-1',
    icon: <DocumentIcon className="h-4 w-4 text-neutral-500" />,
  },
  {
    title: 'Actionable feedback',
    description: (
      <>
        Nx Cloud lets you see what went wrong, and how to fix it. It understands
        your command and lets you find the logs you need.
      </>
    ),
    header: <ActionableErrorFeedback />,
    className: 'md:col-span-1',
    icon: <InboxArrowDownIcon className="h-4 w-4 text-neutral-500" />,
  },
];
