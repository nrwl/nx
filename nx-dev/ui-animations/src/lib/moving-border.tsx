import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { ReactNode, useRef } from 'react';
import { usePrefersReducedMotion } from './prefers-reduced-motion';

/**
 * Creates a moving border effect around the specified component by animating a rectangular SVG element.
 *
 * @param {object} options - The options for the MovingBorder effect.
 * @param {ReactNode} options.children - The content to be displayed within the moving border.
 * @param {number} [options.duration=2000] - The duration of the animation in milliseconds.
 * @param {string} [options.rx] - The x-axis radius of the border corners.
 * @param {string} [options.ry] - The y-axis radius of the border corners.
 * @param {any} [options.otherProps] - Additional properties to be applied to the SVG element.
 *
 * @return {ReactNode} - The MovingBorder component.
 */
export function MovingBorder({
  children,
  duration = 2000,
  rx,
  ry,
  ...otherProps
}: {
  children: ReactNode;
  duration?: number;
  rx?: string;
  ry?: string;
  [key: string]: any;
}) {
  const pathRef = useRef<any>();
  const progress = useMotionValue<number>(0);

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) {
      const pxPerMillisecond = length / duration;
      progress.set((time * pxPerMillisecond) % length);
    }
  });

  const x = useTransform(
    progress,
    (val) => pathRef.current?.getPointAtLength(val).x
  );
  const y = useTransform(
    progress,
    (val) => pathRef.current?.getPointAtLength(val).y
  );

  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  const shouldReduceMotion = usePrefersReducedMotion();
  if (shouldReduceMotion) {
    return;
  }

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        {...otherProps}
      >
        <rect
          fill="none"
          width="100%"
          height="100%"
          rx={rx}
          ry={ry}
          ref={pathRef}
        />
      </svg>
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'inline-block',
          transform,
        }}
      >
        {children}
      </motion.div>
    </>
  );
}
