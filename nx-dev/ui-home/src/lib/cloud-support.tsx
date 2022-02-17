import { motion, useAnimation } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ReactComponentElement, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

export function CloudSupport(): ReactComponentElement<any> {
  const opacityTranslateXVariant = {
    hidden: {
      opacity: 0,
      x: 46,
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
    <article id="next-gen-cloud-support" className="mt-16 md:mt-32">
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
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:col-start-1 lg:mx-0 lg:max-w-none lg:py-32 lg:px-0">
          <div>
            <div className="mt-6">
              <motion.h1
                variants={opacityVariant}
                className="text-3xl font-extrabold tracking-tight text-gray-900"
              >
                Next Gen Cloud Support
              </motion.h1>
              <motion.p
                variants={opacityVariant}
                className="mt-4 text-lg text-gray-500"
              >
                Share links with your teammates where everyone working on a
                project can examine detailed build logs and get insights about
                how to improve your project and build.
              </motion.p>
              <motion.div variants={opacityVariant} className="mt-6">
                <Link href="https://nx.app">
                  <a
                    title="Enable Nx generation monorepo tooling with NxCloud"
                    className="bg-blue-nx-base hover:bg-blue-nx-dark inline-flex rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm transition"
                  >
                    Enable Nx Cloud
                  </a>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="mt-12 sm:mt-16 lg:col-start-2 lg:mt-0"
        >
          <div className="relative px-4 sm:pr-6 lg:h-full lg:px-0">
            <motion.div
              variants={opacityTranslateXVariant}
              className="mx-auto w-full max-w-screen-sm overflow-hidden rounded-xl border border-gray-300 shadow-xl lg:absolute lg:left-16 lg:-top-28 lg:h-full lg:w-auto lg:max-w-none"
            >
              <Image
                src="/images/nx-cloud.webp"
                alt="Nx Cloud app"
                layout={'fixed'}
                width={718}
                height={510}
              />
            </motion.div>
            <motion.div
              variants={opacityTranslateXVariant}
              custom={0.25}
              className="mx-auto hidden w-full max-w-screen-sm overflow-hidden rounded-xl border border-gray-300 shadow-xl lg:absolute lg:-left-20 lg:-bottom-64 lg:flex lg:h-full lg:w-auto lg:max-w-none"
            >
              <Image
                src="/images/github-app.webp"
                alt="Nx Cloud Github app"
                layout={'fixed'}
                width={715}
                height={510}
              />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </article>
  );
}

export default CloudSupport;
