import { SectionHeading } from './section-tags';
import {
  TanstackIcon,
  LernaIcon,
  AngularIcon,
  EpicWebIcon,
  RedwoodJsIcon,
  StorybookIcon,
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
    logo: null,
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
    logo: AngularIcon,
    url: 'https://github.com/angular-eslint/angular-eslint',
  },
  {
    name: 'Strapi',
    logo: null,
    url: 'https://github.com/strapi/strapi',
  },
  {
    name: 'Sentry',
    logo: null,
    url: 'https://github.com/getsentry/sentry-javascript',
  },
  {
    name: 'MUI',
    logo: null,
    url: 'https://github.com/mui/material-ui',
  },
];
export function OssProjects(): JSX.Element {
  return (
    <section>
      <div className="relative isolate pb-24 pt-16">
        <svg
          className="absolute inset-0 -z-10 h-full w-full rotate-180 transform stroke-slate-100 [mask-image:radial-gradient(100%_100%_at_top,white,transparent)] dark:stroke-slate-800/60 dark:[mask-image:radial-gradient(100%_100%_at_top,black,transparent)]"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="83dwp7e5a-9d52-45fc-17c6-718e5d7fe918"
              width={200}
              height={200}
              x="50%"
              y={-1}
              patternUnits="userSpaceOnUse"
            >
              <path d="M100 200V.5M.5 .5H200" fill="none" />
            </pattern>
          </defs>
          <svg
            x="50%"
            y={-1}
            className="overflow-visible fill-slate-50/15 dark:fill-slate-900/10"
          >
            <path
              d="M-100.5 0h201v201h-201Z M699.5 0h201v201h-201Z M499.5 400h201v201h-201Z M-300.5 600h201v201h-201Z"
              strokeWidth={0}
            />
          </svg>
          <rect
            width="100%"
            height="100%"
            strokeWidth={0}
            fill="url(#83dwp7e5a-9d52-45fc-17c6-718e5d7fe918)"
          />
        </svg>
        <div className="mx-auto max-w-7xl text-center">
          <SectionHeading as="h2" variant="subtitle">
            OSS projects using Nx
          </SectionHeading>

          <div className="mt-20">
            <motion.dl
              initial="hidden"
              variants={variants}
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-2 justify-between gap-6 sm:grid-cols-3 lg:grid-cols-6"
            >
              {ossProjects.map(
                (oss, index) =>
                  oss.logo && (
                    <motion.div
                      custom={index + 1}
                      variants={itemVariants}
                      key={oss.name}
                      className="flex items-center justify-center"
                    >
                      <Link href={oss.url} target="_blank">
                        <oss.logo aria-hidden="true" className="h-16 w-16" />
                      </Link>
                    </motion.div>
                  )
              )}
            </motion.dl>
          </div>
        </div>
      </div>
    </section>
  );
}
