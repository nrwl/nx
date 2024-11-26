import { cx } from '@nx/nx-dev/ui-primitives';
import { usePrefersReducedMotion } from './prefers-reduced-motion';

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
  [key: string]: any;
}

/**
 * Creates a marquee component that animates its children horizontally or vertically.
 *
 * @param {Object} props - The props for the marquee component.
 * @param {string} [props.className] - Additional class name(s) to be added to the component.
 * @param {boolean} [props.reverse=false] - Whether to reverse the marquee animation.
 * @param {boolean} [props.pauseOnHover=false] - Whether to pause the marquee animation on hover.
 * @param {ReactNode} props.children - The content to be displayed within the marquee.
 * @param {boolean} [props.vertical=false] - Whether to animate the marquee vertically.
 * @param {number} [props.repeat=4] - The number of times to repeat the marquee animation.
 * @param {any} props... - Additional props to be passed to the underlying div element.
 *
 * @return {ReactElement} The marquee component.
 */
export function Marquee({
  className,
  reverse,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}: MarqueeProps) {
  const shouldReduceMotion = usePrefersReducedMotion();

  return (
    <div
      {...props}
      className={cx(
        'group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]',
        {
          'flex-row': !vertical,
          'flex-col': vertical,
        },
        className
      )}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cx('flex shrink-0 justify-around [gap:var(--gap)]', {
              'animate-marquee flex-row': !vertical,
              'animate-marquee-vertical flex-col': vertical,
              '[animation-play-state:paused]': shouldReduceMotion,
              'group-hover:[animation-play-state:paused]': pauseOnHover,
              '[animation-direction:reverse]': reverse,
            })}
          >
            {children}
          </div>
        ))}
    </div>
  );
}
