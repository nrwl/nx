import { motion, useAnimation } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ReactComponentElement, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

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
    <article id="vscode-plugin" className="mt-16 md:mt-32">
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
                Visual Studio Code Plugin
              </motion.h1>
              <motion.p
                variants={opacityVariant}
                className="mt-4 text-lg text-gray-500"
              >
                Nx Console adds Nx-aware autocompletion and code lenses. It
                helps you generate components in folders, refactor your
                projects, construct commands, and much more.
              </motion.p>
              <motion.div variants={opacityVariant} className="mt-6">
                <Link href="/using-nx/console">
                  <a
                    title="Get a better monorepo experience with Nx Console"
                    className="bg-blue-nx-base hover:bg-blue-nx-dark inline-flex rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm transition"
                  >
                    Install Nx Console
                  </a>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="mt-12 sm:mt-16 lg:col-start-1 lg:mt-0"
        >
          <div className="relative px-4 lg:h-full lg:px-0">
            <motion.div
              variants={opacityTranslateXVariant}
              className="mx-auto -mt-8 w-full max-w-screen-sm overflow-hidden rounded-xl border border-gray-300 shadow-xl lg:absolute lg:right-0 lg:h-full lg:w-auto lg:max-w-none"
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
    </article>
  );
}

export default VscodePlugin;
