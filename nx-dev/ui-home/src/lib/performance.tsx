import {
  animate,
  motion,
  MotionValue,
  useAnimation,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { ReactComponentElement, useEffect, useRef } from 'react';
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
  const [ref, inView] = useInView({ triggerOnce: true });

  useEffect(() => {
    if (!inView) return;
    controls.start('visible');
    animate(progress, 1000, {
      type: 'spring',
      damping: 50,
    });
  }, [controls, inView, progress]);

  return (
    <article id="performance" className="mt-80">
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
                Nx is Fast
              </motion.h1>
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
          <div className="col-span-1 flex flex-col justify-center border-r border-b border-gray-100 p-8 lg:pt-0 lg:pl-0 lg:pb-8 lg:pr-8">
            <div className="text-lg text-gray-600">Up to</div>
            <div
              aria-hidden="true"
              className="my-2 text-7xl font-bold text-gray-800"
            >
              <Counter from={0} to={3} round={0} progress={progress} />{' '}
              <span className="-ml-3 text-3xl">x</span>
            </div>
            <div className="text-md font-medium text-gray-600">
              <span className="sr-only">3 times </span>
              reduction in CI time for mid-size projects with standard CI setups
            </div>
          </div>
          <div className="col-span-1 flex flex-col justify-center border-l border-b border-gray-100 p-8 lg:pr-0 lg:pt-0 lg:pb-8 lg:pl-8">
            <div className="text-lg text-gray-600">Up to</div>
            <div
              aria-hidden="true"
              className="my-2 text-7xl font-bold text-gray-800"
            >
              <Counter from={0} to={14} round={0} progress={progress} />{' '}
              <span className="-ml-3 text-3xl">x</span>
            </div>
            <div className="text-md font-medium text-gray-600">
              <span className="sr-only">14 times </span>
              reduction in CI time for large projects with standard CI setups
            </div>
          </div>
          <div className="col-span-1 flex flex-col justify-center border-r border-t border-gray-100 p-8 lg:pb-0 lg:pl-0 lg:pt-8 lg:pr-8">
            <div className="text-lg text-gray-600">Up to</div>
            <div
              aria-hidden="true"
              className="my-2 text-7xl font-bold text-gray-800"
            >
              <Counter from={0} to={50} round={0} progress={progress} />{' '}
              <span className="-ml-3 text-3xl">%</span>
            </div>
            <div className="text-md font-medium text-gray-600">
              <span className="sr-only">50 times </span>
              reduction in CI time for large projects with highly-optimized
              distributed CI setups
            </div>
          </div>
          <div className="col-span-1 flex flex-col justify-center border-l border-t border-gray-100 p-8 lg:pb-0 lg:pr-0 lg:pt-8 lg:pl-8">
            <div className="text-lg text-gray-600">Average</div>
            <div
              aria-hidden="true"
              className="my-2 text-7xl font-bold text-gray-800"
            >
              <Counter from={0} to={2.5} round={1} progress={progress} />{' '}
              <span className="-ml-3 text-3xl">x</span>
            </div>
            <div className="text-md font-medium text-gray-600">
              <span className="sr-only">2,5 times </span>
              reduction in computation time
            </div>
          </div>
        </div>
      </motion.div>
    </article>
  );
}

export default Performance;
