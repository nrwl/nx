import { ReactComponentElement, useEffect } from 'react';
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
    classNames: 'bg-pink-500',
    link: '#',
    title: 'Smart rebuilds',
    subTitle: 'Only rebuilds and retests what is affected by your change',
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
          d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-green-nx-base',
    link: '#',
    title: 'Project graph',
    subTitle:
      'Analyzes your workspace to improve performance and developer experience',
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="currentColor"
        viewBox="0 0 16 16"
      >
        <path
          fillRule="evenodd"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6v1H14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 2 7h5.5V6A1.5 1.5 0 0 1 6 4.5v-1zM8.5 5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1zM0 11.5A1.5 1.5 0 0 1 1.5 10h1A1.5 1.5 0 0 1 4 11.5v1A1.5 1.5 0 0 1 2.5 14h-1A1.5 1.5 0 0 1 0 12.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zm4.5.5A1.5 1.5 0 0 1 7.5 10h1a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 8.5 14h-1A1.5 1.5 0 0 1 6 12.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zm4.5.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1z"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-yellow-500',
    link: '#',
    title: 'Distributed task execution',
    subTitle:
      'Distributes any command across multiple machines without any configuration',
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
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-blue-500',
    link: '#',
    title: 'Computation caching',
    subTitle: 'Never rebuilds or tests the same code twice',
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
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-purple-nx-base',
    link: '#',
    title: 'Easy code sharing',
    subTitle: 'Simplifies extracting and refactoring shared libraries',
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
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
  },
  {
    classNames: 'bg-red-500',
    link: '#',
    title: 'Ownership management',
    subTitle:
      'Statically enforces the separation of shared and app-specific code',
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
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
];

export function MonorepoFeatures(): ReactComponentElement<any> {
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
  const [ref, inView] = useInView({ threshold: 0.5, triggerOnce: true });

  useEffect(() => {
    if (!inView) return;
    controls.start('visible');
  }, [controls, inView]);

  return (
    <div className="relative">
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
        <div className="px-4 max-w-xl mx-auto sm:px-6 lg:py-16 lg:max-w-none lg:mx-0 lg:px-0">
          <div>
            <div className="mt-6">
              <motion.h2
                variants={opacityVariant}
                className="text-3xl font-extrabold tracking-tight text-gray-900"
              >
                Best-in-Class Support for Monorepos
              </motion.h2>
              <motion.p
                variants={opacityVariant}
                className="mt-4 text-lg text-gray-500"
              >
                Nx builds a project graph by analyzing your workspace, which it
                then uses to only rebuild what is necessary, and to never run
                the same computation twice. Nx also helps establish structured
                code sharing and ownership management to keep the workspace
                maintainable.
              </motion.p>
              <motion.div variants={opacityVariant} className="mt-6">
                <Link href="#">
                  <a className="inline-flex px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-nx-base hover:bg-purple-nx-base transition">
                    Get started
                  </a>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="mt-12 sm:mt-16 lg:mt-0">
          <div className="px-4 m-0 lg:px-0 lg:relative lg:h-full">
            <div className="h-full py-14 grid items-center grid-cols-1 md:grid-cols-2 gap-4">
              {featureItems.map((item, index: number) => (
                <motion.div
                  key={'monorepo-feature-' + index}
                  variants={opacityTranslateXVariant}
                  className={cx(
                    'relative rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-md flex items-center space-x-4 hover:bg-gray-50 transition focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-nx-base',
                    [2, 3].includes(index) && 'lg:-left-8'
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

export default MonorepoFeatures;
