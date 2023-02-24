import {
  CogIcon,
  CommandLineIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import cx from 'classnames';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { transition, variants } from './motion.helpers';

export function IdeIntegrationTab(): JSX.Element {
  const features = [
    {
      connectionWidth: 'w-96',
      name: 'Generate anything',
      icon: <CogIcon className="h-5 w-5" />,
      description:
        'No need to remember the commands and options available. See everything at a glance. Great for exploring.',
      link: '/recipes/nx-console/console-generate-command',
    },
    {
      connectionWidth: 'w-[668px]',
      name: 'Run anything',
      icon: <CommandLineIcon className="h-5 w-5" />,
      description:
        'Easy access to your projects and scripts from the context menu, command palette and augmented config files. Perfectly integrated into your flow.',
      link: '/recipes/nx-console/console-run-command',
    },
    {
      connectionWidth: 'w-48',
      name: 'The best companion for Nx',
      icon: <SparklesIcon className="h-5 w-5" />,
      description:
        'The Nx team is obsessed with providing the best possible DX. Nx Console is the culmination of that. Carefully crafted, in constant evolution, always in search of making the life of developers easier.',
      link: '/core-features/integrate-with-editors',
    },
  ];
  return (
    <motion.div
      initial="hidden"
      variants={variants}
      animate="visible"
      transition={transition}
      exit="hidden"
      className="wrapper my-8 grid h-full items-center gap-16 md:grid-cols-2 lg:grid-cols-3"
    >
      <div className="lg:col-span-2">
        <div className="w-full overflow-hidden overflow-hidden rounded-lg rounded-lg border border-slate-200 shadow-lg shadow dark:hidden dark:border-slate-700">
          <Image
            src="/images/nx-console/vscode-light.webp"
            alt="Nx Console app screenshot"
            loading="lazy"
            width={800}
            height={800}
          />
        </div>
        <div className="hidden w-full overflow-hidden overflow-hidden rounded-lg rounded-lg border border-slate-200 shadow-lg shadow dark:block dark:border-slate-700">
          <Image
            src="/images/nx-console/vscode-dark.webp"
            alt="Nx Console app screenshot"
            loading="lazy"
            width={800}
            height={800}
          />
        </div>
      </div>
      <div className="relative flex flex-col gap-8">
        {features.map((feature) => (
          <div
            key={feature.name}
            className="group relative rounded-lg px-4 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800/40 sm:flex"
          >
            <div
              className={cx(
                'absolute -left-4 hidden -translate-x-full translate-y-12 items-center xl:flex',
                feature.connectionWidth
              )}
            >
              <span className="absolute top-0 left-0 -mt-1 -ml-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 transition dark:bg-sky-500" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 transition group-hover:bg-blue-600 group-hover:bg-sky-600 dark:bg-slate-700" />
              </span>
              <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 transition dark:bg-sky-500" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 transition group-hover:bg-blue-600 group-hover:bg-sky-600 dark:bg-slate-700" />
              </span>
              <div className="-m-0.5 h-0.5 w-full bg-slate-200 transition group-hover:bg-blue-500 dark:bg-slate-700 dark:group-hover:bg-sky-500" />
            </div>
            <div className="sm:flex-shrink-0">
              <div className="flow-root">{feature.icon}</div>
            </div>
            <div className="mt-3 sm:mt-0 sm:ml-3">
              <h3 className="text-sm font-medium">{feature.name}</h3>
              <Link href={feature.link}>
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="mt-2 text-sm text-slate-500">
                  {feature.description}
                </p>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
