import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { memo, useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from './prefers-reduced-motion';

/**
 * Animates a value and renders it with a specified suffix.
 *
 * @param {Object} params - The parameters for animating the value.
 * @param {number} params.num - The number to animate.
 * @param {boolean} [params.once=false] - Flag indicating if the animation should only run once.
 * @param {string} params.suffix - The suffix to append to the animated value.
 * @param {number} [params.decimals=0] - The number of decimal places to display for the animated value.
 *
 * @return {JSX.Element} - The JSX element representing the animated value with suffix.
 */
function AnimateValueEngine({
  num,
  once = false,
  suffix,
  decimals = 0,
}: {
  num: number;
  once?: boolean;
  suffix: string;
  decimals?: number;
}): JSX.Element {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref);
  const shouldReduceMotion = usePrefersReducedMotion();
  const motionValue = useMotionValue(0);
  const formattedValue = useTransform(motionValue, (latest) =>
    latest.toFixed(decimals)
  );

  useEffect(() => {
    if (!isInView || (once && motionValue.get() === num)) return;

    animate(motionValue, num, {
      duration: shouldReduceMotion ? 0 : 2.5,
      type: 'tween',
    });
  }, [num, isInView, once, motionValue, shouldReduceMotion]);

  return (
    <>
      <span ref={ref}>
        <motion.span>{formattedValue}</motion.span>
      </span>
      {suffix}
    </>
  );
}

export const AnimateValue = memo(AnimateValueEngine);
