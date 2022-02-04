import React, { ReactComponentElement, useEffect } from 'react';
import Link from 'next/link';
import cx from 'classnames';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const featureItems: {
  classNames: string;
  link: string;
  subTitle: string;
  svg: ReactComponentElement<any>;
  title: string;
}[] = [
  {
    classNames: 'bg-green-nx-base',
    link: '/getting-started/nx-devkit',
    title: 'Plugins for everything',
    subTitle:
      'React, React Native, Angular, NativeScript, Cypress, Nest.js, Storybook, Ionic, Go among others.',
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-pink-500',
    link: '/using-nx/nx-cli',
    title: 'Consistent DX',
    subTitle: 'Nx improves dev mobility, experimentation and collaboration.',
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-yellow-500',
    link: '/using-nx/updating-nx',
    title: 'Automatic upgrades.',
    subTitle:
      'Nx updates your source code to work with the newest versions of popular tools.',
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-purple-nx-base',
    link: '/using-nx/updating-nx',
    title: 'Repeatable migrations',
    subTitle: 'Nx enables large scale refactorings.',
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-red-500',
    link: '/community',
    title: 'Large community',
    subTitle: 'A community of more than 600k developers, doubling every year.',
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-blue-500',
    link: 'https://github.com/nrwl/nx',
    title: 'Open source',
    subTitle: 'MIT-licensed, clear roadmap and transparency.',
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
        />
      </svg>
    ),
  },
];

export function EcosystemFeatures(): ReactComponentElement<any> {
  const opacityTranslateXVariant = {
    hidden: {
      opacity: 0,
      x: 46,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.32 },
    },
  };
  const opacityVariant = {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: { duration: 0.32, ease: 'easeOut' },
    },
  };
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true });

  useEffect(() => {
    if (!inView) return;
    controls.start('visible');
  }, [controls, inView]);

  return (
    <article id="rich-plugin-ecosystem" className="relative">
      <motion.div
        ref={ref}
        animate={controls}
        initial="hidden"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              when: 'beforeChildren',
              staggerChildren: 0.12,
              ease: 'linear',
              duration: 0.24,
              type: 'tween',
            },
          },
        }}
        className="lg:mx-auto lg:grid lg:max-w-7xl lg:grid-flow-col-dense lg:grid-cols-2 lg:gap-24 lg:px-8"
      >
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:col-start-1 lg:mx-0 lg:max-w-none lg:py-16 lg:px-0">
          <div>
            <div className="mt-6">
              <motion.h1
                variants={opacityVariant}
                className="text-3xl font-extrabold tracking-tight text-gray-900"
              >
                Rich Plugin Ecosystem
              </motion.h1>
              <motion.p
                variants={opacityVariant}
                className="mt-4 text-lg text-gray-500"
              >
                The core of Nx is generic, simple, and unobtrusive. Nx Plugins
                are completely optional, but they can really level up your
                productivity.
              </motion.p>
            </div>
          </div>
        </div>
        <div className="md:mt-16 lg:col-start-2 lg:mt-0">
          <div className="m-0 px-4 lg:relative lg:h-full lg:px-0">
            <div className="grid h-full grid-cols-1 items-center gap-4 py-14 md:grid-cols-2">
              {featureItems.map((item, index: number) => (
                <motion.div
                  key={'monorepo-feature-' + index}
                  variants={opacityTranslateXVariant}
                  className={cx(
                    'focus-within:ring-blue-nx-base relative flex items-center space-x-4 rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-md transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-gray-50',
                    [2, 3].includes(index) && 'lg:left-8'
                  )}
                >
                  <div
                    className={cx(
                      'flex-shrink-0 rounded-full p-2 text-white ',
                      item.classNames
                    )}
                  >
                    {item.svg}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={item.link}>
                      <a className="focus:outline-none">
                        <span className="absolute inset-0" aria-hidden="true" />
                        <p className="mb-0.5 text-sm font-bold text-gray-700">
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-400">{item.subTitle}</p>
                      </a>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </article>
  );
}

export default EcosystemFeatures;
