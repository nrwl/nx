'use client';
import { motion, useInView, useWillChange, Variants } from 'framer-motion';
import { ReactNode, useRef, useMemo } from 'react';
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
  const isInView = useMemo(
    () => !inView || inViewResult,
    [inView, inViewResult]
  );

  const variants = useMemo((): Variants => {
    return (
      variant || {
        hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
        visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
      }
    );
  }, [variant, yOffset, blur]);

  const shouldReduceMotion = usePrefersReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      style={{ willChange: willChange }}
      transition={{
        delay: 0.04 + delay,
        duration,
        ease: 'easeOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
