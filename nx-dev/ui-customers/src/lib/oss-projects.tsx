import { SectionHeading } from './section-tags';
import {
  TanstackIcon,
  LernaIcon,
  EpicWebIcon,
  RedwoodJsIcon,
  StorybookIcon,
  RxJSIcon,
  SentryIcon,
  MuiIcon,
} from '@nx/nx-dev/ui-common';
import { motion } from 'framer-motion';
import Link from 'next/link';

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
      delay: i * 0.25,
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

const ossProjects = [
  {
    name: 'Tanstack',
    logo: TanstackIcon,
    url: 'https://github.com/tanstack',
  },
  {
    name: 'EpicWeb',
    logo: EpicWebIcon,
    url: 'https://github.com/epicweb-dev/epicshop',
  },
  {
    name: 'RedwoodJS',
    logo: RedwoodJsIcon,
    url: 'https://redwoodjs.com/',
  },
  {
    name: 'Storybook',
    logo: StorybookIcon,
    url: 'https://github.com/storybookjs/storybook',
  },
  {
    name: 'Cypress',
    logo: null,
    url: 'https://github.com/cypress-io/cypress',
  },
  {
    name: 'Lerna',
    logo: LernaIcon,
    url: 'https://lerna.js.org',
  },
  {
    name: 'BuilderIO Mitosis',
    logo: null,
    url: 'https://github.com/BuilderIO/mitosis',
  },
  {
    name: 'RxJS',
    logo: RxJSIcon,
    url: 'https://github.com/ReactiveX/rxjs',
  },
  {
    name: 'Electron Forge',
    logo: null,
    url: 'https://github.com/electron/forge',
  },
  {
    name: 'TypeScript ESLint',
    logo: null,
    url: 'https://github.com/typescript-eslint/typescript-eslint',
  },
  {
    name: 'Angular ESLint',
    logo: null,
    url: 'https://github.com/angular-eslint/angular-eslint',
  },
  {
    name: 'Strapi',
    logo: null,
    url: 'https://github.com/strapi/strapi',
  },
  {
    name: 'Sentry',
    logo: SentryIcon,
    url: 'https://github.com/getsentry/sentry-javascript',
  },
  {
    name: 'MUI',
    logo: MuiIcon,
    url: 'https://github.com/mui/material-ui',
  },
];
export function OssProjects(): JSX.Element {
  return (
    <section>
      <div className="mx-auto max-w-7xl text-center">
        <SectionHeading as="h2" variant="subtitle">
          Popular OSS projects using Nx
        </SectionHeading>

        <div className="mt-20">
          <motion.dl
            initial="hidden"
            variants={variants}
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 justify-between sm:grid-cols-4"
          >
            <motion.div
              custom={1}
              variants={itemVariants}
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <Link href="https://github.com/tanstack'" target="_blank">
                <TanstackIcon aria-hidden="true" className="h-16 w-16" />
              </Link>
            </motion.div>
            <motion.div
              custom={2}
              variants={itemVariants}
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <Link
                href="https://github.com/epicweb-dev/epicshop"
                target="_blank"
              >
                <EpicWebIcon aria-hidden="true" className="h-16 w-16" />
              </Link>
            </motion.div>
            <motion.div
              custom={3}
              variants={itemVariants}
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <Link href="https://redwoodjs.com/" target="_blank">
                <RedwoodJsIcon aria-hidden="true" className="h-16 w-16" />
              </Link>
            </motion.div>
            <motion.div
              custom={4}
              variants={itemVariants}
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <Link
                href="https://github.com/storybookjs/storybook"
                target="_blank"
              >
                <StorybookIcon aria-hidden="true" className="h-16 w-16" />
              </Link>
            </motion.div>
            <motion.div
              custom={5}
              variants={itemVariants}
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <Link href="https://lerna.js.org'" target="_blank">
                <LernaIcon aria-hidden="true" className="h-16 w-16" />
              </Link>
            </motion.div>
            <motion.div
              custom={6}
              variants={itemVariants}
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <Link href="https://github.com/ReactiveX/rxjs" target="_blank">
                <RxJSIcon aria-hidden="true" className="h-16 w-16" />
              </Link>
            </motion.div>
            <motion.div
              custom={7}
              variants={itemVariants}
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <Link
                href="https://github.com/getsentry/sentry-javascript"
                target="_blank"
              >
                <SentryIcon aria-hidden="true" className="h-16 w-16" />
              </Link>
            </motion.div>
            <motion.div
              custom={8}
              variants={itemVariants}
              className="flex items-center justify-center border border-slate-200/20 p-12 transition hover:bg-slate-100/25 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10"
            >
              <Link href="https://github.com/mui/material-ui" target="_blank">
                <MuiIcon aria-hidden="true" className="h-16 w-16" />
              </Link>
            </motion.div>
          </motion.dl>
        </div>
      </div>
    </section>
  );
}
