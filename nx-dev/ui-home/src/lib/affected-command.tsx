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
        className="lg:mx-auto lg:grid lg:max-w-7xl lg:grid-flow-col-dense lg:grid-cols-2 lg:gap-24 lg:px-8"
      >
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:col-start-2 lg:mx-0 lg:max-w-none lg:py-32 lg:px-0">
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
                    className="bg-blue-nx-base hover:bg-blue-nx-dark inline-flex rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm transition"
                  >
                    Learn about "nx affected"
                  </a>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
        <div
          className="mt-12 sm:mt-16 lg:col-start-1 lg:mt-0"
          aria-hidden="true"
        >
          <div className="relative px-4 sm:pr-6 md:-ml-16 lg:relative lg:m-0 lg:h-full lg:px-0">
            <motion.div
              variants={opacityTranslateXVariant}
              className="-mt-8 w-full max-w-screen-sm overflow-hidden rounded-xl border border-gray-300 shadow-xl lg:absolute lg:right-0 lg:h-full lg:w-auto lg:max-w-none"
            >
              <Image
                src="/images/nx-affected.webp"
                alt="Nx affected graph"
                layout={'fixed'}
                width={727}
                height={482}
              />
            </motion.div>
            <motion.div
              variants={opacityTranslateXVariant}
              custom={0.25}
              className="absolute -bottom-8 right-8 hidden rounded-xl bg-gray-500 shadow-xl md:flex"
            >
              <div
                className="coding inverse-toggle overflow-hidden rounded-lg bg-gray-800 px-5 pt-4 pb-6 pt-4
              font-mono text-xs leading-normal text-gray-200 subpixel-antialiased shadow-lg"
              >
                <div className="top mb-2 flex">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="ml-2 h-3 w-3 rounded-full bg-yellow-300" />
                  <div className="ml-2 h-3 w-3 rounded-full bg-green-500" />
                </div>
                <div className="mt-4 flex">
                  <span className="text-green-400">/workspace ➜</span>
                  <p className="typing flex-1 items-center pl-2">
                    nx affected:test --parallel
                  </p>
                </div>
                <div className="mt-2 flex">
                  <p className="typing flex-1 items-center pl-2">
                    <span className="text-green-400">{'>'}</span>{' '}
                    <span className="bg-blue-nx-base px-1 py-0.5">NX</span>
                    <span className="ml-1 bg-yellow-500 px-1 py-0.5">
                      NOTE
                    </span>{' '}
                    Affected criteria defaulted to --base=master --head=HEAD
                    <br />
                    <br />
                    <span className="text-green-400">{'>'}</span>{' '}
                    <span className="bg-blue-nx-base mr-1 px-1 py-0.5">NX</span>{' '}
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
                    <span className="bg-green-nx-base px-1 py-0.5">
                      RUNS
                    </span>{' '}
                    <span className="bg-gray-200 px-1 py-0.5 text-gray-700">
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
