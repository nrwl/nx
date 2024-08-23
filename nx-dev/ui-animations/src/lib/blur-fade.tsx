'use client';
import {
  AnimatePresence,
  motion,
  useInView,
  useWillChange,
  Variants,
} from 'framer-motion';
import { ReactNode, useRef } from 'react';
import { usePrefersReducedMotion } from './prefers-reduced-motion';

interface BlurFadeProps {
  children: ReactNode;
  className?: string;
  variant?: {
    hidden: { y: number };
    visible: { y: number };
  };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: string;
  blur?: string;
  once?: boolean;
}

/**
 * Applies a blur fade effect to its children based on the scroll position.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child elements to apply the effect to.
 * @param {string} [props.className] - The CSS class to apply to the component.
 * @param {Object} [props.variant] - The animation variants to apply.
 * @param {number} [props.duration=0.4] - The duration of the animation in seconds.
 * @param {number} [props.delay=0] - The delay before starting the animation in seconds.
 * @param {number} [props.yOffset=6] - The distance the element moves on the Y-axis during the animation.
 * @param {boolean} [props.inView=false] - Specifies whether the animation should trigger when the element is in view.
 * @param {string} [props.inViewMargin='-50px'] - The margin to consider when checking if the element is in view.
 * @param {string} [props.blur='5px'] - The amount of blur to apply to the element during the animation.
 * @param {boolean} [props.once=false] - Specifies whether the animation should only trigger once.
 *
 * @return {React.ReactNode} The component with the blur fade effect applied.
 */
export function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  inView = false,
  inViewMargin = '-50px',
  blur = '5px',
  once = false,
}: BlurFadeProps) {
  const willChange = useWillChange();
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once, margin: inViewMargin });
  const isInView = !inView || inViewResult;
  const defaultVariants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
  };
  const combinedVariants = variant || defaultVariants;

  const shouldReduceMotion = usePrefersReducedMotion();
  if (shouldReduceMotion) {
    return;
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        exit="hidden"
        variants={combinedVariants}
        style={{ willChange }}
        transition={{
          delay: 0.04 + delay,
          duration,
          ease: 'easeOut',
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
