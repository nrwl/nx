import { motion, useInView, useMotionValue, useTransform } from 'framer-motion';
import { ComponentRef, ReactNode, useEffect, useRef, useCallback } from 'react';
import { cx } from '@nx/nx-dev/ui-primitives';

export function FitText({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  const containerRef = useRef<ComponentRef<'div'>>(null);
  const textRef = useRef<ComponentRef<'span'>>(null);
  const isInView = useInView(containerRef);
  const fontSize = useMotionValue(16);
  const scaledFontSize = useTransform(fontSize, (size) => `${size}px`);

  const resizeText = useCallback(() => {
    const container = containerRef.current;
    const text = textRef.current;

    if (!container || !text) return;

    const containerWidth = container.offsetWidth;
    let min = 1;
    let max = 2500;

    while (min <= max) {
      const mid = Math.floor((min + max) / 2);
      text.style.fontSize = mid + 'px';

      if (text.offsetWidth <= containerWidth) {
        min = mid + 1;
      } else {
        max = mid - 1;
      }
    }

    fontSize.set(max);
  }, [fontSize]);

  useEffect(() => {
    if (!isInView) return;
    resizeText();
    window.addEventListener('resize', resizeText);

    return () => {
      window.removeEventListener('resize', resizeText);
    };
  }, [isInView, resizeText]);

  return (
    <span
      className="relative grid h-full w-full grid-cols-1 place-items-center"
      ref={containerRef}
    >
      <motion.span
        className={cx(
          'transform whitespace-nowrap text-center font-bold',
          className
        )}
        ref={textRef}
        style={{ fontSize: scaledFontSize }}
      >
        {children}
      </motion.span>
    </span>
  );
}
