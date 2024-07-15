import {
  AdjustmentsVerticalIcon,
  ArrowLongDownIcon,
  CircleStackIcon,
  CodeBracketSquareIcon,
} from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common/src/lib/section-tags';
import { motion } from 'framer-motion';
import { NxCloudIcon } from '@nx/nx-dev/ui-common';

export function AutomatedAgentsManagement(): JSX.Element {
  const variants = {
    hidden: {
      opacity: 0,
      transition: {
        when: 'afterChildren',
      },
    },
    visible: (i: number) => ({
      opacity: 1,
      transition: {
        delay: i || 0,
      },
    }),
  };
  const itemVariants = {
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.035,
        duration: 0.65,
        ease: 'easeOut',
        when: 'beforeChildren',
        staggerChildren: 0.3,
      },
    }),
    hidden: {
      opacity: 0,
      y: 4,
      transition: {
        when: 'afterChildren',
      },
    },
  };

  return (
    <section id="competitive-compute" className="overflow-hidden">
      <div className="mx-auto max-w-7xl md:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:grid-cols-2 lg:items-start">
          <div className="px-6 md:px-0 lg:pr-4 lg:pt-4">
            <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-lg">
              <SectionHeading
                as="h2"
                variant="title"
                id="seamless-distribution"
              >
                Seamless distribution, faster CI
              </SectionHeading>
              <SectionHeading as="p" variant="subtitle" className="mt-6">
                Nx Cloud dynamically adapts to your CI needs - providing an
                excellent developer experience while minimizing your costs.
              </SectionHeading>

              <dl className="mt-12 max-w-xl space-y-4 text-base leading-7">
                <div className="relative pl-9">
                  <dt className="inline font-semibold text-slate-950 dark:text-white">
                    <AdjustmentsVerticalIcon
                      aria-hidden="true"
                      className="absolute left-1 top-1 h-5 w-5"
                    />
                    Perfect provisioning.{' '}
                  </dt>
                  <dd className="inline">
                    Instruct Nx Cloud to dynamically allocate the right number
                    of agents for each pull request.
                  </dd>
                </div>
                <div className="relative pl-9">
                  <dt className="inline font-semibold text-slate-950 dark:text-white">
                    <CircleStackIcon
                      aria-hidden="true"
                      className="absolute left-1 top-1 h-5 w-5"
                    />
                    Effortless CI integration.{' '}
                  </dt>
                  <dd className="inline">
                    Utilize additional compute from Nx Cloud and enjoy faster
                    and cheaper CI with your existing provider.
                  </dd>
                </div>
                <div className="relative pl-9">
                  <dt className="inline font-semibold text-slate-950 dark:text-white">
                    <CodeBracketSquareIcon
                      aria-hidden="true"
                      className="absolute left-1 top-1 h-5 w-5"
                    />
                    Simple configuration.{' '}
                  </dt>
                  <dd className="inline">
                    Add a single line to your CI configuration to enable
                    distribution, computation caching, E2E test splitting, and
                    more.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="mt-4 flex flex-col justify-items-stretch gap-4 sm:px-6 lg:px-0">
            <motion.div
              initial="hidden"
              variants={variants}
              whileInView="visible"
              viewport={{ once: true }}
              className="relative rounded-md border border-slate-100 p-4 dark:border-slate-800"
            >
              <div className="rounded-lg border border-dashed border-slate-300 p-2 dark:border-slate-500">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Your CI provider
                </p>
                <div className="mt-4 grid grid-cols-2 items-center gap-1">
                  <motion.p variants={itemVariants}>
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                      nx affected -t lint build test
                    </span>
                  </motion.p>

                  <p className="mt-1 text-xs">
                    on job:{' '}
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                      main-linux
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
            <motion.div
              custom={0.5}
              initial="hidden"
              variants={variants}
              whileInView="visible"
              viewport={{ once: true }}
              className="text-center"
            >
              <ArrowLongDownIcon
                aria-hidden="true"
                className="inline-flex h-6 w-6"
              />
            </motion.div>
            <motion.div
              custom={1}
              initial="hidden"
              variants={variants}
              whileInView="visible"
              viewport={{ once: true }}
              className="coding z-10 mx-4 rounded-lg border border-slate-200 p-4 font-mono text-xs leading-normal text-slate-800 subpixel-antialiased dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <div className="flex items-start">
                <p>
                  <span className="mx-0.5 text-green-600 dark:text-green-400">
                    ~
                  </span>{' '}
                  <span>$</span>
                </p>
                <p className="typing flex-1 pl-1">
                  npx nx-cloud start-ci-run --distribute-on="15
                  linux-medium-plus-js"
                </p>
              </div>
            </motion.div>
            <motion.div
              custom={1.5}
              initial="hidden"
              variants={variants}
              whileInView="visible"
              viewport={{ once: true }}
              className="text-center"
            >
              <ArrowLongDownIcon
                aria-hidden="true"
                className="inline-flex h-6 w-6"
              />
            </motion.div>
            <motion.div
              custom={2}
              initial="hidden"
              variants={variants}
              whileInView="visible"
              viewport={{ once: true }}
              className="relative grid grid-cols-2 gap-2 rounded-md border border-slate-100 p-4 dark:border-slate-800"
            >
              <div className="rounded-lg border border-dashed border-slate-300 p-2 dark:border-slate-500">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Your CI provider
                </p>
                <div className="mt-4">
                  <p>
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                      nx affected -t lint build test
                    </span>
                  </p>
                  <p className="mt-1 text-xs">
                    on job:{' '}
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                      main-linux
                    </span>
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-slate-500 p-2 dark:border-slate-500">
                <p className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                  <NxCloudIcon className="h-4 w-4" aria-hidden="true" />
                  Nx Cloud
                </p>
                <div className="mt-4 flex flex-col items-start gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                      nx run build
                    </span>
                    on Agent 1, Agent 2, Agent 3
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                      nx run test
                    </span>
                    on Agent 1, Agent 4
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                      nx run lint
                    </span>
                    on Agent 1, Agent 2, Agent 4
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
