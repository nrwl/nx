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
    classNames: 'bg-blue-500',
    link: '/getting-started/console',
    title: 'Editor plugins',
    subTitle: 'Nx-aware autocompletion and refactoring.',
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        viewBox="0 0 24 24"
        stroke="transparent"
        fill="currentColor"
      >
        <path d="M17.583.063a1.5 1.5 0 00-1.032.392 1.5 1.5 0 00-.001 0A.88.88 0 0016.5.5L8.528 9.316 3.875 5.5l-.407-.35a1 1 0 00-1.024-.154 1 1 0 00-.012.005l-1.817.75a1 1 0 00-.077.036 1 1 0 00-.047.028 1 1 0 00-.038.022 1 1 0 00-.048.034 1 1 0 00-.03.024 1 1 0 00-.044.036 1 1 0 00-.036.033 1 1 0 00-.032.035 1 1 0 00-.033.038 1 1 0 00-.035.044 1 1 0 00-.024.034 1 1 0 00-.032.05 1 1 0 00-.02.035 1 1 0 00-.024.05 1 1 0 00-.02.045 1 1 0 00-.016.044 1 1 0 00-.016.047 1 1 0 00-.015.055 1 1 0 00-.01.04 1 1 0 00-.008.054 1 1 0 00-.006.05A1 1 0 000 6.668v10.666a1 1 0 00.615.917l1.817.764a1 1 0 001.035-.164l.408-.35 4.653-3.815 7.973 8.815a1.5 1.5 0 00.072.065 1.5 1.5 0 00.057.05 1.5 1.5 0 00.058.042 1.5 1.5 0 00.063.044 1.5 1.5 0 00.065.038 1.5 1.5 0 00.065.036 1.5 1.5 0 00.068.031 1.5 1.5 0 00.07.03 1.5 1.5 0 00.073.025 1.5 1.5 0 00.066.02 1.5 1.5 0 00.08.02 1.5 1.5 0 00.068.014 1.5 1.5 0 00.075.01 1.5 1.5 0 00.075.008 1.5 1.5 0 00.073.003 1.5 1.5 0 00.077 0 1.5 1.5 0 00.078-.005 1.5 1.5 0 00.067-.007 1.5 1.5 0 00.087-.015 1.5 1.5 0 00.06-.012 1.5 1.5 0 00.08-.022 1.5 1.5 0 00.068-.02 1.5 1.5 0 00.07-.028 1.5 1.5 0 00.09-.037l4.944-2.377a1.5 1.5 0 00.476-.362 1.5 1.5 0 00.09-.112 1.5 1.5 0 00.004-.007 1.5 1.5 0 00.08-.125 1.5 1.5 0 00.062-.12 1.5 1.5 0 00.009-.017 1.5 1.5 0 00.04-.108 1.5 1.5 0 00.015-.037 1.5 1.5 0 00.03-.107 1.5 1.5 0 00.009-.037 1.5 1.5 0 00.017-.1 1.5 1.5 0 00.008-.05 1.5 1.5 0 00.006-.09 1.5 1.5 0 00.004-.08V3.942a1.5 1.5 0 000-.003 1.5 1.5 0 000-.032 1.5 1.5 0 00-.01-.15 1.5 1.5 0 00-.84-1.17L18.206.21a1.5 1.5 0 00-.622-.146zM18 6.92v10.163l-6.198-5.08zM3 8.574l3.099 3.427-3.1 3.426z" />
      </svg>
    ),
  },
  {
    classNames: 'bg-red-500',
    link: 'https://github.com/apps/nx-cloud',
    title: 'GitHub & CI',
    subTitle: 'Searchable and filterable CI outputs, analytics, and more.',
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  {
    classNames: 'bg-pink-500',
    link: '/getting-started/nx-cli#modifying-code',
    title: 'Powerful code generation',
    subTitle: 'Nx automates repeatable tasks and refactorings.',
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
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-green-nx-base',
    link: '/structure/dependency-graph',
    title: 'Interactive visualizations',
    subTitle:
      'An evergreen architecture diagram to help explore and understand your workspace.',
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
          d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-yellow-500',
    link: '/generators/workspace-generators',
    title: 'Workspace generators',
    subTitle: 'Nx helps enforce best practices and organizational standards.',
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
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-purple-nx-base',
    link: '/core-concepts/nx-devkit',
    title: 'Nx Devkit',
    subTitle:
      'Nx enables a custom dev experience to match the needs of your organization.',
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
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
        />
      </svg>
    ),
  },
];

export function ExperienceFeatures(): ReactComponentElement<any> {
  const opacityTranslateXVariant = {
    hidden: {
      opacity: 0,
      x: -46,
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
    <div id="integrated-development-experience" className="relative">
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
        className="lg:mx-auto lg:max-w-7xl lg:px-8 lg:grid lg:grid-cols-2 lg:grid-flow-col-dense lg:gap-24"
      >
        <div className="px-4 max-w-xl mx-auto sm:px-6 lg:py-16 lg:max-w-none lg:mx-0 lg:px-0 lg:col-start-2">
          <div>
            <div className="mt-6">
              <motion.h2
                variants={opacityVariant}
                className="text-3xl font-extrabold tracking-tight text-gray-900"
              >
                Integrated Development Experience
              </motion.h2>
              <motion.p
                variants={opacityVariant}
                className="mt-4 text-lg text-gray-500"
              >
                Nx provides a modern integrated dev experience. It has a
                high-quality VS Code plugin, interactive visualizations, GitHub
                integration and more.
              </motion.p>
            </div>
          </div>
        </div>
        <div className="md:mt-16 lg:mt-0 lg:col-start-1">
          <div className="px-4 m-0 lg:px-0 lg:relative lg:h-full">
            <div className="h-full py-14 grid items-center grid-cols-1 md:grid-cols-2 gap-4">
              {featureItems.map((item, index: number) => (
                <motion.div
                  key={'monorepo-feature-' + index}
                  variants={opacityTranslateXVariant}
                  className={cx(
                    'relative rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-md flex items-center space-x-4 hover:bg-gray-50 transition focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-nx-base',
                    [2, 3].includes(index) && 'lg:left-8'
                  )}
                >
                  <div
                    className={cx(
                      'flex-shrink-0 p-2 rounded-full text-white ',
                      item.classNames
                    )}
                  >
                    {item.svg}
                  </div>
                  <div className="flex-1 min-w-0">
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
    </div>
  );
}

export default ExperienceFeatures;
