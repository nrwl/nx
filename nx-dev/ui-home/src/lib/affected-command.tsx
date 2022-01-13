import React, { ReactComponentElement, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

export function AffectedCommand(): ReactComponentElement<any> {
  const opacityTranslateXVariant = {
    hidden: {
      opacity: 0,
      x: -46,
    },
    visible: (delay: number = 0) => ({
      opacity: 1,
      x: 0,
      transition: { delay, duration: 0.32 },
    }),
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
    <article id="nx-affected" className="mt-16 md:mt-32">
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
        <div className="px-4 max-w-xl mx-auto sm:px-6 lg:py-32 lg:max-w-none lg:mx-0 lg:px-0 lg:col-start-2">
          <div>
            <div className="mt-6">
              <motion.h1
                variants={opacityVariant}
                className="text-3xl font-extrabold tracking-tight text-gray-900"
              >
                Build and Test Only What is Affected
              </motion.h1>
              <motion.p
                variants={opacityVariant}
                className="mt-4 text-lg text-gray-500"
              >
                Nx is smart. It analyzes your workspace and figures out what can
                be affected by every code change. That's why Nx doesn't rebuild
                and retest everything on every commit - it only rebuilds what is
                necessary.
              </motion.p>
              <motion.div variants={opacityVariant} className="mt-6">
                <Link href="/using-nx/affected">
                  <a
                    title="Nx allows you to see what is affected by your changes"
                    className="inline-flex px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-nx-base hover:bg-blue-nx-dark transition"
                  >
                    Learn about "nx affected"
                  </a>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
        <div
          className="mt-12 sm:mt-16 lg:mt-0 lg:col-start-1"
          aria-hidden="true"
        >
          <div className="relative px-4 sm:pr-6 md:-ml-16 lg:px-0 lg:m-0 lg:relative lg:h-full">
            <motion.div
              variants={opacityTranslateXVariant}
              className="-mt-8 w-full max-w-screen-sm rounded-xl shadow-xl border border-gray-300 lg:absolute lg:right-0 lg:h-full lg:w-auto lg:max-w-none overflow-hidden"
            >
              <Image
                src="/images/nx-affected.webp"
                alt="Nx affected dep-graph"
                layout={'fixed'}
                width={727}
                height={482}
              />
            </motion.div>
            <motion.div
              variants={opacityTranslateXVariant}
              custom={0.25}
              className="hidden md:flex absolute -bottom-8 right-8 bg-gray-500 rounded-xl shadow-xl"
            >
              <div
                className="coding inverse-toggle px-5 pt-4 shadow-lg text-gray-200 text-xs font-mono subpixel-antialiased
              bg-gray-800 pb-6 pt-4 rounded-lg leading-normal overflow-hidden"
              >
                <div className="top mb-2 flex">
                  <div className="h-3 w-3 bg-red-500 rounded-full" />
                  <div className="ml-2 h-3 w-3 bg-yellow-300 rounded-full" />
                  <div className="ml-2 h-3 w-3 bg-green-500 rounded-full" />
                </div>
                <div className="mt-4 flex">
                  <span className="text-green-400">/workspace ➜</span>
                  <p className="flex-1 typing items-center pl-2">
                    nx affected:test --parallel
                  </p>
                </div>
                <div className="mt-2 flex">
                  <p className="flex-1 typing items-center pl-2">
                    <span className="text-green-400">{'>'}</span>{' '}
                    <span className="px-1 py-0.5 bg-blue-nx-base">NX</span>
                    <span className="ml-1 px-1 py-0.5 bg-yellow-500">
                      NOTE
                    </span>{' '}
                    Affected criteria defaulted to --base=master --head=HEAD
                    <br />
                    <br />
                    <span className="text-green-400">{'>'}</span>{' '}
                    <span className="px-1 py-0.5 bg-blue-nx-base mr-1">NX</span>{' '}
                    Running target test for 3 project(s):
                    <br />
                    - nx-dev <br />
                    - nx-dev-ui-common <br />- nx-dev-feature-doc-viewer
                    <br />
                    ———————————————————————————————————————————————
                    <br />
                    <span className="text-green-400">{'>'}</span> nx run
                    nx-dev:test RUNS nx-dev
                    <br />
                    <span className="px-1 py-0.5 bg-green-nx-base">
                      RUNS
                    </span>{' '}
                    <span className="px-1 py-0.5 bg-gray-200 text-gray-700">
                      nx-dev
                    </span>{' '}
                    nx-dev/nx-dev/specs/index.spec.tsx
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </article>
  );
}

export default AffectedCommand;
