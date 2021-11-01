import React, { ReactComponentElement, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  animate,
  motion,
  MotionValue,
  useAnimation,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { useInView } from 'react-intersection-observer';

function Counter({
  from = 0,
  to = 10,
  round = 0,
  progress,
}: {
  from: number;
  to: number;
  round: number;
  progress: MotionValue<number>;
}): ReactComponentElement<any> {
  const ref = useRef();
  const value = useTransform(progress, [0, 1000], [from, to], {
    clamp: false,
  });

  const { format: formatNumber } = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: round,
    maximumFractionDigits: round,
  });

  useEffect(() => {
    return value.onChange((v) => {
      if (ref !== undefined && ref.current !== undefined)
        ref.current.firstChild.data = formatNumber(
          round === 0 ? Math.round(v) : Number(v.toFixed(round))
        );
    });
  }, [formatNumber, round, value]);

  return <span ref={ref}>{formatNumber(value.get())}</span>;
}

export function Performance(): ReactComponentElement<any> {
  const progress: MotionValue<number> = useMotionValue(0);
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
    animate(progress, 1000, {
      type: 'spring',
      damping: 50,
    });
  }, [controls, inView, progress]);

  return (
    <div className="mt-80">
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
                Nx is Fast
              </motion.h2>
              <motion.p
                variants={opacityVariant}
                className="mt-4 text-lg text-gray-500"
              >
                Nx uses its distributed task execution and computation caching
                to keep your CI time the same, whether you build one project or
                a thousand.
              </motion.p>
            </div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:col-start-1">
          <div className="col-span-1 flex flex-col justify-center pb-8 pl-8 border-r border-b border-gray-100">
            <div className="text-lg text-gray-600">Average</div>
            <div className="my-2 text-7xl font-bold text-gray-800">
              <Counter from={0} to={300} round={0} progress={progress} />{' '}
              <span className="-ml-3 text-3xl">%</span>
            </div>
            <div className="text-md font-medium text-gray-600">sf</div>
          </div>
          <div className="col-span-1 flex flex-col justify-center pb-8 pl-8 border-l border-b border-gray-100">
            <div className="text-lg text-gray-600">Average</div>
            <div className="my-2 text-7xl font-bold text-gray-800">
              <Counter from={0} to={250} round={0} progress={progress} />{' '}
              <span className="-ml-3 text-3xl">%</span>
            </div>
            <div className="text-md font-medium text-gray-600">
              Reduction in CI computation time due to caching
            </div>
          </div>
          <div className="col-span-1 flex flex-col justify-center pt-8 pl-8 border-r border-t border-gray-100">
            <div className="text-lg text-gray-600">Down to</div>
            <div className="my-2 text-7xl font-bold text-gray-800">
              <Counter from={0} to={105} round={0} progress={progress} />{' '}
              <span className="-ml-3 text-3xl">ms</span>
            </div>
            <div className="text-md font-medium text-gray-600">
              Graph calculations for 1k projects
            </div>
          </div>
          <div className="col-span-1 flex flex-col justify-center pt-8 pl-8 border-l border-t border-gray-100">
            <div className="text-lg text-gray-600">Up to</div>
            <div className="my-2 text-7xl font-bold text-gray-800">
              <Counter from={0} to={10} round={0} progress={progress} />{' '}
              <span className="-ml-3 text-3xl">x</span>
            </div>
            <div className="text-md font-medium text-gray-600">
              Faster CI for larger proj
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Performance;
