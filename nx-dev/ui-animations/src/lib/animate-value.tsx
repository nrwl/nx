import { animate, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
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
export function AnimateValue({
  num,
  once = false,
  suffix,
  decimals = 0,
}: {
  num: number;
  once?: boolean;
  suffix: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const isInView = useInView(ref);
  const shouldReduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!isInView) return;
    if (isComplete && once) return;

    animate(0, num, {
      duration: shouldReduceMotion ? 0 : 2.5,
      onUpdate(value) {
        if (!ref.current) return;

        ref.current.textContent = value.toFixed(decimals);
      },
    });
    setIsComplete(true);
  }, [num, decimals, isInView, once]);

  return (
    <span>
      <span ref={ref}></span>
      <span>{suffix}</span>
    </span>
  );
}
