import {
  Variants,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { useEffect } from 'react';
import { Spotlight } from './elements/spotlight';

export function FasterAndCheaper(): JSX.Element {
  const spotlight: Variants = {
    offscreen: {
      display: 'none',
    },
    onscreen: {
      display: 'block',
    },
  };

  const ciBar: Variants = {
    start: {
      width: 0,
    },
    end: {
      width: '100%',
      transition: {
        type: 'tween',
        ease: 'easeOut',
        duration: 1.2,
      },
    },
  };
  const nxBar: Variants = {
    start: {
      width: 0,
    },
    end: {
      width: '50%',
      transition: {
        type: 'tween',
        ease: 'easeOut',
        duration: 1.2,
      },
    },
  };

  return (
    <section>
      <motion.div
        initial="offscreen"
        whileInView="onscreen"
        viewport={{ once: true }}
        className="relative mx-auto max-w-7xl px-6 lg:px-8"
      >
        <motion.div
          variants={spotlight}
          className="absolute left-1/2 z-0 h-[50%] w-[50%] transform-gpu"
        >
          <Spotlight className="w-full max-w-full" fill="pink" />
        </motion.div>

        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-medium tracking-tight text-slate-950 sm:text-5xl dark:text-white">
            Both faster & cheaper
          </h2>
          <p className="mt-6 text-2xl leading-7 text-slate-700 dark:text-slate-300">
            Nx Cloud makes your CI significantly faster and cheaper, while also
            making it more maintainable and reliable.
          </p>
        </div>
        <div className="relative z-20 mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-5xl">
          <div className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-2">
            <article className="group/card relative grid transform-gpu cursor-default items-center gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm transition duration-200 hover:-translate-y-4 hover:shadow-xl md:col-span-1 dark:border-slate-800 dark:bg-slate-950/50 dark:shadow-none">
              <div className="p-4 text-center">
                <div className="mt-2 text-3xl font-medium leading-7 text-slate-950 transition duration-200 lg:text-8xl dark:text-white">
                  <Counter value={30}></Counter> -{' '}
                  <Counter value={70}></Counter>%
                </div>
                <div className="mt-4 text-3xl font-medium leading-7 text-slate-950 transition duration-200 lg:text-5xl dark:text-white">
                  Faster CI
                </div>
                <div className="mt-4 text-sm text-slate-600 transition duration-200 group-hover/card:text-slate-400 dark:text-slate-400 group-hover/card:dark:text-slate-600">
                  Reported by enterprises using Nx Cloud.
                </div>
              </div>
            </article>
            <article className="group/card relative grid transform-gpu cursor-default items-center gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm transition duration-200 hover:-translate-y-4 hover:shadow-xl md:col-span-1 dark:border-slate-800 dark:bg-slate-950/50 dark:shadow-none">
              <div className="p-4 text-center">
                <div className="mt-4 text-center text-3xl font-medium leading-7 text-slate-950 transition duration-200 lg:text-5xl dark:text-white">
                  Halve your CI bill
                </div>
                <div className="mt-6">
                  <div className="flex items-center">
                    <div className="w-28 shrink-0 border-r-2 border-slate-200 py-3 pr-2 text-right text-slate-700 transition duration-200 dark:border-slate-800 dark:text-slate-300">
                      CI
                    </div>
                    <div className="flex-grow py-1.5 font-semibold">
                      <motion.div
                        initial="start"
                        whileInView="end"
                        variants={ciBar}
                        viewport={{ once: true }}
                        className="w-full flex-grow items-center justify-end rounded-r-lg border border-l-0 border-slate-200 bg-slate-100 px-4 py-2 text-right text-slate-900 transition duration-200 dark:border-slate-800 dark:bg-slate-700 dark:text-white"
                      >
                        <span className="drop-shadow-sm">$6k</span>
                      </motion.div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-28 shrink-0 border-r-2 border-slate-200 py-3 pr-2 text-right font-medium text-slate-700 transition duration-200 dark:border-slate-800 dark:text-slate-300">
                      CI + Nx Cloud
                    </div>
                    <div className="flex-grow py-1.5 font-semibold">
                      <motion.div
                        initial="start"
                        whileInView="end"
                        variants={nxBar}
                        viewport={{ once: true }}
                        className="w-1/2 rounded-r-lg border border-l-0 border-slate-200 bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-right text-white transition duration-200 dark:border-slate-800"
                      >
                        <span className="drop-shadow-sm">$3.2k</span>
                      </motion.div>
                    </div>
                  </div>
                </div>
                <p className="mt-6 text-xs text-slate-400 transition duration-200 dark:text-slate-600">
                  <span className="underline">
                    Cost per month for CI compute.
                  </span>{' '}
                  Data collected based on a typical month of CI runs measured on
                  the Nx OSS monorepo.
                </p>
              </div>
            </article>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Counter({
  value,
  duration = 2,
}: {
  value: number;
  duration?: number;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    const animation = animate(count, value, {
      type: 'tween',
      ease: 'easeOut',
      duration,
    });

    return animation.stop;
  }, []);

  return <motion.span>{rounded}</motion.span>;
}
