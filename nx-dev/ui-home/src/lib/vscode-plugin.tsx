import React, { ReactComponentElement, useEffect } from 'react';
import Link from 'next/link';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';

export function VscodePlugin(): ReactComponentElement<any> {
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
    <div id="vscode-plugin" className="mt-16 md:mt-32">
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
              <motion.h2
                variants={opacityVariant}
                className="text-3xl font-extrabold tracking-tight text-gray-900"
              >
                Visual Studio Code Plugin
              </motion.h2>
              <motion.p
                variants={opacityVariant}
                className="mt-4 text-lg text-gray-500"
              >
                Nx Console adds Nx-aware autocompletion and code lenses. It
                helps you generate components in folders, refactor your
                projects, construct commands, and much more.
              </motion.p>
              <motion.div variants={opacityVariant} className="mt-6">
                <Link href="/getting-started/console">
                  <a className="inline-flex px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-nx-base hover:bg-blue-nx-dark transition">
                    Install Nx Console
                  </a>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="mt-12 sm:mt-16 lg:mt-0 lg:col-start-1">
          <div className="relative px-4 lg:px-0 lg:h-full">
            <motion.div
              variants={opacityTranslateXVariant}
              className="-mt-8 mx-auto w-full max-w-screen-sm rounded-xl shadow-xl border border-gray-300 lg:absolute lg:right-0 lg:h-full lg:w-auto lg:max-w-none overflow-hidden"
            >
              <Image
                src="/images/nx-console.webp"
                alt="Nx Console VS Code plugin"
                layout={'fixed'}
                width={690}
                height={482}
              />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default VscodePlugin;
